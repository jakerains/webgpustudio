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
  gravity: f32,
  friction: f32,
  numParticles: u32,
  mouseX: f32,
  mouseY: f32,
  mouseActive: f32,
  boundaryX: f32,
  boundaryY: f32,
  colorMode: u32,
  time: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particlesOut: array<Particle>;

fn hash(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
  let c = v * s;
  let hp = h * 6.0;
  let x = c * (1.0 - abs(hp % 2.0 - 1.0));
  let m = v - c;
  var rgb: vec3f;
  if (hp < 1.0) { rgb = vec3f(c, x, 0.0); }
  else if (hp < 2.0) { rgb = vec3f(x, c, 0.0); }
  else if (hp < 3.0) { rgb = vec3f(0.0, c, x); }
  else if (hp < 4.0) { rgb = vec3f(0.0, x, c); }
  else if (hp < 5.0) { rgb = vec3f(x, 0.0, c); }
  else { rgb = vec3f(c, 0.0, x); }
  return rgb + vec3f(m, m, m);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= params.numParticles) {
    return;
  }

  var p = particlesIn[idx];

  // Gravity well attraction
  if (params.mouseActive > 0.5) {
    let mousePos = vec2f(params.mouseX, params.mouseY);
    let diff = mousePos - p.pos;
    let dist = max(length(diff), 5.0);
    let force = normalize(diff) * params.gravity * 50.0 / (dist * 0.5);
    p.vel += force * params.deltaTime;
  }

  // Subtle ambient drift based on particle index for organic motion
  let drift = vec2f(
    sin(params.time * 0.3 + f32(idx) * 0.01) * 0.5,
    cos(params.time * 0.2 + f32(idx) * 0.013) * 0.5
  );
  p.vel += drift * params.deltaTime;

  // Friction
  p.vel *= params.friction;

  // Speed limit
  let speed = length(p.vel);
  let maxSpeed = 500.0;
  if (speed > maxSpeed) {
    p.vel = normalize(p.vel) * maxSpeed;
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
  let life = fract(p.color.w + params.deltaTime * 0.1);

  // Compute color based on mode
  let spd = length(p.vel);
  var rgb: vec3f;

  if (params.colorMode == 0u) {
    // Rainbow: hue based on velocity angle + speed brightness
    let angle = atan2(p.vel.y, p.vel.x);
    let hue = fract((angle / 6.283185) + life * 0.5 + params.time * 0.05);
    let sat = 0.7 + 0.3 * clamp(spd / 200.0, 0.0, 1.0);
    let val = 0.6 + 0.4 * clamp(spd / 150.0, 0.0, 1.0);
    rgb = hsv2rgb(hue, sat, val);
  } else if (params.colorMode == 1u) {
    // Temperature: blue (cold/slow) -> red (hot/fast)
    let t = clamp(spd / 250.0, 0.0, 1.0);
    let cold = vec3f(0.15, 0.35, 0.85);
    let warm = vec3f(0.95, 0.55, 0.1);
    let hot = vec3f(1.0, 0.2, 0.15);
    if (t < 0.5) {
      rgb = mix(cold, warm, t * 2.0);
    } else {
      rgb = mix(warm, hot, (t - 0.5) * 2.0);
    }
  } else {
    // Monochrome: warm accent color with brightness from speed
    let base = vec3f(0.76, 0.45, 0.31); // ~#C2724E
    let bright = 0.5 + 0.5 * clamp(spd / 200.0, 0.0, 1.0);
    rgb = base * bright;
  }

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
};

struct CanvasSize {
  width: f32,
  height: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> canvasSize: CanvasSize;

@vertex
fn main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VSOutput {
  let p = particles[instanceIndex];

  // Convert pixel position to NDC (-1..1)
  let ndcX = (p.pos.x / canvasSize.width) * 2.0 - 1.0;
  let ndcY = -((p.pos.y / canvasSize.height) * 2.0 - 1.0);

  // Quad vertices for instanced rendering (2 triangles)
  let pointSize = 3.0;
  let pixelW = pointSize / canvasSize.width;
  let pixelH = pointSize / canvasSize.height;

  // Speed-based size
  let speed = length(p.vel);
  let sizeMul = 1.0 + clamp(speed / 300.0, 0.0, 1.5);
  let hw = pixelW * sizeMul;
  let hh = pixelH * sizeMul;

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
  return out;
}
`;

export const fragmentShader = /* wgsl */ `

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) pointCenter: vec2f,
  @location(2) pointPos: vec2f,
};

@fragment
fn main(in: VSOutput) -> @location(0) vec4f {
  // Soft circle: distance-based alpha falloff
  let diff = in.pointPos - in.pointCenter;
  let dist = length(diff) * 300.0; // scale to reasonable range
  let alpha = 1.0 - smoothstep(0.0, 1.0, dist);

  if (alpha < 0.01) {
    discard;
  }

  return vec4f(in.color.rgb, alpha * 0.85);
}
`;
