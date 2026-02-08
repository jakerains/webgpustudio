// WGSL shaders for the particle simulator
// Compute shader updates physics, vertex/fragment shaders render particles

export const computeShader = /* wgsl */ `

struct Particle {
  pos: vec2f,
  vel: vec2f,
  color: vec4f,
};

struct SimParams {
  deltaTime: f32,
  friction: f32,
  numParticles: u32,
  mouseX: f32,
  mouseY: f32,
  mouseActive: f32,
  boundaryX: f32,
  boundaryY: f32,
  time: f32,
  flowStrength: f32,
  flowScale: f32,
  swirlStrength: f32,
  pointerStrength: f32,
  pointerRadius: f32,
  pointerMode: f32,
  speedLimit: f32,
  trailFade: f32,
  palette: u32,
  sizeBase: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particlesOut: array<Particle>;

fn rand(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let a = rand(i);
  let b = rand(i + vec2f(1.0, 0.0));
  let c = rand(i + vec2f(0.0, 1.0));
  let d = rand(i + vec2f(1.0, 1.0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

fn curlNoise(p: vec2f) -> vec2f {
  let eps = 0.2;
  let n1 = noise(p + vec2f(0.0, eps));
  let n2 = noise(p - vec2f(0.0, eps));
  let n3 = noise(p + vec2f(eps, 0.0));
  let n4 = noise(p - vec2f(eps, 0.0));
  let dx = (n1 - n2) / (2.0 * eps);
  let dy = (n3 - n4) / (2.0 * eps);
  return vec2f(dx, -dy);
}

fn paletteColor(palette: u32, t: f32) -> vec3f {
  let inkDark = vec3f(0.12, 0.08, 0.05);
  let inkWarm = vec3f(0.82, 0.56, 0.36);
  let sandDark = vec3f(0.63, 0.49, 0.32);
  let sandLight = vec3f(0.95, 0.88, 0.7);
  let emberDark = vec3f(0.25, 0.06, 0.05);
  let emberLight = vec3f(1.0, 0.55, 0.2);

  if (palette == 0u) {
    return mix(inkDark, inkWarm, t);
  } else if (palette == 1u) {
    return mix(sandDark, sandLight, t);
  }

  let emberT = pow(t, 1.2);
  return mix(emberDark, emberLight, emberT);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= params.numParticles) {
    return;
  }

  var p = particlesIn[idx];

  // Pointer attraction/repulsion + swirl
  if (params.mouseActive > 0.5) {
    let mousePos = vec2f(params.mouseX, params.mouseY);
    let diff = mousePos - p.pos;
    let dist = length(diff) + 0.001;
    let dir = diff / dist;
    let radius = max(params.pointerRadius, 1.0);
    let falloff = exp(-(dist * dist) / (radius * radius));
    let strength = params.pointerStrength * falloff;
    p.vel += dir * strength * params.deltaTime * params.pointerMode;

    let tangent = vec2f(-dir.y, dir.x);
    p.vel += tangent * params.swirlStrength * falloff * params.deltaTime;
  }

  // Flow field (curl noise) for painterly motion
  let flowPos = p.pos * params.flowScale + vec2f(params.time * 0.05, params.time * 0.03);
  let flow = curlNoise(flowPos);
  p.vel += flow * params.flowStrength * params.deltaTime;

  // Friction
  p.vel *= params.friction;

  // Speed limit
  let speed = length(p.vel);
  if (speed > params.speedLimit) {
    p.vel = normalize(p.vel) * params.speedLimit;
  }

  // Integrate position
  p.pos += p.vel * params.deltaTime;

  // Boundary bounce
  let margin = 2.0;
  if (p.pos.x < margin) {
    p.pos.x = margin;
    p.vel.x = abs(p.vel.x) * 0.8;
  }
  if (p.pos.x > params.boundaryX - margin) {
    p.pos.x = params.boundaryX - margin;
    p.vel.x = -abs(p.vel.x) * 0.8;
  }
  if (p.pos.y < margin) {
    p.pos.y = margin;
    p.vel.y = abs(p.vel.y) * 0.8;
  }
  if (p.pos.y > params.boundaryY - margin) {
    p.pos.y = params.boundaryY - margin;
    p.vel.y = -abs(p.vel.y) * 0.8;
  }

  // Update life (cycles 0..1 for color animation)
  let life = fract(p.color.w + params.deltaTime * 0.12);

  let speedT = clamp(speed / params.speedLimit, 0.0, 1.0);
  let noiseT = noise(p.pos * 0.005 + vec2f(params.time * 0.2, params.time * 0.15));
  let t = clamp(0.25 + speedT * 0.6 + noiseT * 0.2 + life * 0.1, 0.0, 1.0);
  let rgb = paletteColor(params.palette, t);

  p.color = vec4f(rgb, life);

  particlesOut[idx] = p;
}
`;

export const vertexShader = /* wgsl */ `

struct Particle {
  pos: vec2f,
  vel: vec2f,
  color: vec4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) pointCenter: vec2f,
  @location(2) pointPos: vec2f,
  @location(3) pointRadius: f32,
};

struct RenderParams {
  width: f32,
  height: f32,
  sizeBase: f32,
  speedLimit: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> renderParams: RenderParams;

@vertex
fn main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let p = particles[instanceIndex];

  // Convert pixel position to NDC (-1..1)
  let ndcX = (p.pos.x / renderParams.width) * 2.0 - 1.0;
  let ndcY = -((p.pos.y / renderParams.height) * 2.0 - 1.0);

  // Quad vertices for instanced rendering (2 triangles)
  let pointSize = renderParams.sizeBase;
  let pixelW = pointSize / renderParams.width;
  let pixelH = pointSize / renderParams.height;

  // Speed-based size
  let speed = length(p.vel);
  let sizeMul = 0.7 + clamp(speed / renderParams.speedLimit, 0.0, 1.0) * 1.2;
  let hw = pixelW * sizeMul;
  let hh = pixelH * sizeMul;
  let radius = max(hw, hh);

  var offsets = array<vec2f, 6>(
    vec2f(-hw, -hh),
    vec2f( hw, -hh),
    vec2f(-hw,  hh),
    vec2f(-hw,  hh),
    vec2f( hw, -hh),
    vec2f( hw,  hh),
  );

  let offset = offsets[vertexIndex];
  let pos = vec2f(ndcX + offset.x, ndcY + offset.y);

  var out: VSOutput;
  out.position = vec4f(pos, 0.0, 1.0);
  out.color = vec4f(p.color.rgb, 1.0);
  out.pointCenter = vec2f(ndcX, ndcY);
  out.pointPos = pos;
  out.pointRadius = radius;
  return out;
}
`;

export const fragmentShader = /* wgsl */ `

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) pointCenter: vec2f,
  @location(2) pointPos: vec2f,
  @location(3) pointRadius: f32,
};

@fragment
fn main(in: VSOutput) -> @location(0) vec4f {
  // Soft circle: distance-based alpha falloff
  let diff = in.pointPos - in.pointCenter;
  let dist = length(diff) / max(in.pointRadius, 0.00001);
  let alpha = 1.0 - smoothstep(0.0, 1.0, dist);

  if (alpha < 0.01) {
    discard;
  }

  return vec4f(in.color.rgb, alpha * 0.85);
}
`;

export const trailVertexShader = /* wgsl */ `

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VSOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 0.0),
    vec2f(2.0, 0.0),
    vec2f(0.0, 2.0)
  );

  var out: VSOutput;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  out.uv = uvs[vertexIndex];
  return out;
}
`;

export const trailFragmentShader = /* wgsl */ `

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

struct TrailParams {
  value: vec4f,
};

@group(0) @binding(0) var<uniform> trailParams: TrailParams;

@fragment
fn main(in: VSOutput) -> @location(0) vec4f {
  let bg = vec3f(0.07, 0.05, 0.03);
  return vec4f(bg, trailParams.value.x);
}
`;

export const presentFragmentShader = /* wgsl */ `

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var trailSampler: sampler;
@group(0) @binding(1) var trailTexture: texture_2d<f32>;

@fragment
fn main(in: VSOutput) -> @location(0) vec4f {
  let color = textureSample(trailTexture, trailSampler, in.uv);
  return vec4f(color.rgb, 1.0);
}
`;
