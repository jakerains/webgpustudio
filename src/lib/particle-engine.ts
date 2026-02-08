import {
  computeShader,
  vertexShader,
  fragmentShader,
  trailVertexShader,
  trailFragmentShader,
  presentFragmentShader,
} from "./particle-shaders";
import { ParticlePalette, ParticlePresetParams } from "./particle-presets";

// Stride: pos(2) + vel(2) + color(4) = 8 floats per particle
const PARTICLE_STRIDE = 8;
const FLOATS_PER_F32 = 4; // bytes

export type PointerMode = "attract" | "repel";

export interface ParticleParams extends ParticlePresetParams {
  pointerMode: PointerMode;
}

const PALETTE_MAP: Record<ParticlePalette, number> = {
  ink: 0,
  sand: 1,
  ember: 2,
};

const POINTER_MODE_MAP: Record<PointerMode, number> = {
  attract: 1,
  repel: -1,
};

// Uniform layout: deltaTime, friction, numParticles, mouseX, mouseY, mouseActive, boundaryX, boundaryY, time,
// flowStrength, flowScale, swirlStrength, pointerStrength, pointerRadius, pointerMode, speedLimit, trailFade, palette, sizeBase, _pad
const UNIFORM_FLOATS = 20;
const UNIFORM_SIZE = UNIFORM_FLOATS * FLOATS_PER_F32; // 20 floats, 80 bytes
const RENDER_PARAMS_SIZE = 4 * FLOATS_PER_F32; // width, height, sizeBase, speedLimit
const TRAIL_PARAMS_SIZE = 4 * FLOATS_PER_F32; // trailFade + padding

export class ParticleEngine {
  private canvas: HTMLCanvasElement;
  private particleCount: number;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  // Buffers
  private particleBuffers!: [GPUBuffer, GPUBuffer]; // ping-pong
  private uniformBuffer!: GPUBuffer;
  private renderParamsBuffer!: GPUBuffer;
  private trailParamsBuffer!: GPUBuffer;

  // Pipelines
  private computePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;
  private trailPipeline!: GPURenderPipeline;
  private presentPipeline!: GPURenderPipeline;

  // Bind groups
  private computeBindGroups!: [GPUBindGroup, GPUBindGroup]; // ping-pong
  private renderBindGroups!: [GPUBindGroup, GPUBindGroup]; // ping-pong
  private trailBindGroup!: GPUBindGroup;
  private presentBindGroup!: GPUBindGroup;

  // Trail resources
  private trailTexture!: GPUTexture;
  private trailTextureView!: GPUTextureView;
  private trailSampler!: GPUSampler;

  private step_: number = 0; // tracks which ping-pong buffer is current
  private lastTime: number = 0;
  private frameCount: number = 0;
  private fpsTime: number = 0;
  private currentFps: number = 0;
  private simTime: number = 0;

  // Simulation parameters
  private friction: number = 0.987;
  private flowStrength: number = 26;
  private flowScale: number = 0.0026;
  private swirlStrength: number = 20;
  private pointerStrength: number = 180;
  private pointerRadius: number = 140;
  private pointerMode: PointerMode = "attract";
  private speedLimit: number = 420;
  private trailFade: number = 0.1;
  private sizeBase: number = 2.4;
  private palette: ParticlePalette = "ink";
  private mouseX: number = 0;
  private mouseY: number = 0;
  private mouseActive: boolean = false;

  constructor(canvas: HTMLCanvasElement, particleCount: number) {
    this.canvas = canvas;
    this.particleCount = particleCount;
  }

  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to get GPU adapter");
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    this.createBuffers();
    this.createPipelines();
    this.createBindGroups();
    this.createHistoryTextures();
    this.initParticles();

    this.lastTime = performance.now();
    this.fpsTime = performance.now();
  }

  private createParticleBuffers(): void {
    const bufferSize = this.particleCount * PARTICLE_STRIDE * FLOATS_PER_F32;

    this.particleBuffers = [
      this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];
  }

  private createBuffers(): void {
    this.createParticleBuffers();

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.renderParamsBuffer = this.device.createBuffer({
      size: RENDER_PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.trailParamsBuffer = this.device.createBuffer({
      size: TRAIL_PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private createPipelines(): void {
    // Compute pipeline
    const computeModule = this.device.createShaderModule({
      code: computeShader,
    });

    const computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      ],
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [computeBindGroupLayout],
      }),
      compute: {
        module: computeModule,
        entryPoint: "main",
      },
    });

    // Render pipeline
    const vertexModule = this.device.createShaderModule({ code: vertexShader });
    const fragmentModule = this.device.createShaderModule({ code: fragmentShader });

    const renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      ],
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [renderBindGroupLayout],
      }),
      vertex: {
        module: vertexModule,
        entryPoint: "main",
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "main",
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this.trailSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const trailVertexModule = this.device.createShaderModule({ code: trailVertexShader });
    const trailFragmentModule = this.device.createShaderModule({ code: trailFragmentShader });
    const presentFragmentModule = this.device.createShaderModule({ code: presentFragmentShader });

    const trailBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    const presentBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ],
    });

    this.trailPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [trailBindGroupLayout],
      }),
      vertex: {
        module: trailVertexModule,
        entryPoint: "main",
      },
      fragment: {
        module: trailFragmentModule,
        entryPoint: "main",
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    this.presentPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [presentBindGroupLayout],
      }),
      vertex: {
        module: trailVertexModule,
        entryPoint: "main",
      },
      fragment: {
        module: presentFragmentModule,
        entryPoint: "main",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  private createBindGroups(): void {
    const computeLayout = this.computePipeline.getBindGroupLayout(0);
    const renderLayout = this.renderPipeline.getBindGroupLayout(0);

    // Ping-pong bind groups for compute
    this.computeBindGroups = [
      this.device.createBindGroup({
        layout: computeLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: this.particleBuffers[0] } },
          { binding: 2, resource: { buffer: this.particleBuffers[1] } },
        ],
      }),
      this.device.createBindGroup({
        layout: computeLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: this.particleBuffers[1] } },
          { binding: 2, resource: { buffer: this.particleBuffers[0] } },
        ],
      }),
    ];

    // Ping-pong bind groups for render (reads from output buffer)
    this.renderBindGroups = [
      this.device.createBindGroup({
        layout: renderLayout,
        entries: [
          { binding: 0, resource: { buffer: this.particleBuffers[1] } },
          { binding: 1, resource: { buffer: this.renderParamsBuffer } },
        ],
      }),
      this.device.createBindGroup({
        layout: renderLayout,
        entries: [
          { binding: 0, resource: { buffer: this.particleBuffers[0] } },
          { binding: 1, resource: { buffer: this.renderParamsBuffer } },
        ],
      }),
    ];
  }

  private createHistoryTextures(): void {
    this.trailTexture?.destroy();

    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);

    this.trailTexture = this.device.createTexture({
      size: { width, height },
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.trailTextureView = this.trailTexture.createView();

    this.createTrailBindGroup();
    this.createPresentBindGroup();
    this.clearTrailTextures();
  }

  private createTrailBindGroup(): void {
    const trailLayout = this.trailPipeline.getBindGroupLayout(0);
    this.trailBindGroup = this.device.createBindGroup({
      layout: trailLayout,
      entries: [{ binding: 0, resource: { buffer: this.trailParamsBuffer } }],
    });
  }

  private createPresentBindGroup(): void {
    const presentLayout = this.presentPipeline.getBindGroupLayout(0);
    this.presentBindGroup = this.device.createBindGroup({
      layout: presentLayout,
      entries: [
        { binding: 0, resource: this.trailSampler },
        { binding: 1, resource: this.trailTextureView },
      ],
    });
  }

  private clearTrailTextures(): void {
    const encoder = this.device.createCommandEncoder();
    const clearValue = { r: 0.07, g: 0.05, b: 0.03, a: 1.0 };

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.trailTextureView,
          clearValue,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  private initParticles(): void {
    const data = new Float32Array(this.particleCount * PARTICLE_STRIDE);
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < this.particleCount; i++) {
      const offset = i * PARTICLE_STRIDE;
      // Position: random within canvas
      data[offset + 0] = Math.random() * w;
      data[offset + 1] = Math.random() * h;
      // Velocity: small random
      data[offset + 2] = (Math.random() - 0.5) * 30;
      data[offset + 3] = (Math.random() - 0.5) * 30;
      // Color: will be set by compute shader, init with defaults
      data[offset + 4] = 0.76; // r
      data[offset + 5] = 0.45; // g
      data[offset + 6] = 0.31; // b
      // Life: random phase
      data[offset + 7] = Math.random();
    }

    this.device.queue.writeBuffer(this.particleBuffers[0], 0, data);
    this.device.queue.writeBuffer(this.particleBuffers[1], 0, data);
  }

  setPointer(x: number, y: number, active: boolean): void {
    this.mouseX = x;
    this.mouseY = y;
    this.mouseActive = active;
  }

  setParams(params: Partial<ParticleParams>): void {
    if (params.friction !== undefined) this.friction = params.friction;
    if (params.flowStrength !== undefined) this.flowStrength = params.flowStrength;
    if (params.flowScale !== undefined) this.flowScale = params.flowScale;
    if (params.swirlStrength !== undefined) this.swirlStrength = params.swirlStrength;
    if (params.pointerStrength !== undefined) this.pointerStrength = params.pointerStrength;
    if (params.pointerRadius !== undefined) this.pointerRadius = params.pointerRadius;
    if (params.pointerMode !== undefined) this.pointerMode = params.pointerMode;
    if (params.speedLimit !== undefined) this.speedLimit = params.speedLimit;
    if (params.trailFade !== undefined) this.trailFade = params.trailFade;
    if (params.sizeBase !== undefined) this.sizeBase = params.sizeBase;
    if (params.palette !== undefined) this.palette = params.palette;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    this.createHistoryTextures();
  }

  step(): void {
    const now = performance.now();
    const deltaTime = Math.min((now - this.lastTime) / 1000, 0.033); // cap at ~30fps dt
    this.lastTime = now;
    this.simTime += deltaTime;

    // FPS counter
    this.frameCount++;
    if (now - this.fpsTime >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsTime = now;
    }

    // Update uniforms
    const uniforms = new Float32Array(UNIFORM_FLOATS);
    uniforms[0] = deltaTime;
    uniforms[1] = this.friction;
    // numParticles as uint32 reinterpreted
    new Uint32Array(uniforms.buffer, 8, 1)[0] = this.particleCount;
    uniforms[3] = this.mouseX;
    uniforms[4] = this.mouseY;
    uniforms[5] = this.mouseActive ? 1.0 : 0.0;
    uniforms[6] = this.canvas.width;
    uniforms[7] = this.canvas.height;
    uniforms[8] = this.simTime;
    uniforms[9] = this.flowStrength;
    uniforms[10] = this.flowScale;
    uniforms[11] = this.swirlStrength;
    uniforms[12] = this.pointerStrength;
    uniforms[13] = this.pointerRadius;
    uniforms[14] = POINTER_MODE_MAP[this.pointerMode];
    uniforms[15] = this.speedLimit;
    uniforms[16] = this.trailFade;
    new Uint32Array(uniforms.buffer, 68, 1)[0] = PALETTE_MAP[this.palette];
    uniforms[18] = this.sizeBase;
    uniforms[19] = 0; // padding

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    // Update render params uniform
    const renderParams = new Float32Array([
      this.canvas.width,
      this.canvas.height,
      this.sizeBase,
      this.speedLimit,
    ]);
    this.device.queue.writeBuffer(this.renderParamsBuffer, 0, renderParams);

    const trailParams = new Float32Array([this.trailFade, 0, 0, 0]);
    this.device.queue.writeBuffer(this.trailParamsBuffer, 0, trailParams);

    const commandEncoder = this.device.createCommandEncoder();

    // Compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroups[this.step_]);
    computePass.dispatchWorkgroups(Math.ceil(this.particleCount / 64));
    computePass.end();

    const clearValue = { r: 0.07, g: 0.05, b: 0.03, a: 1.0 };

    // Trail fade + particle render pass to history texture
    const historyPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.trailTextureView,
          clearValue,
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    historyPass.setPipeline(this.trailPipeline);
    historyPass.setBindGroup(0, this.trailBindGroup);
    historyPass.draw(3, 1, 0, 0);

    historyPass.setPipeline(this.renderPipeline);
    historyPass.setBindGroup(0, this.renderBindGroups[this.step_]);
    // 6 vertices per quad (2 triangles), instanced for each particle
    historyPass.draw(6, this.particleCount, 0, 0);
    historyPass.end();

    // Present pass
    const textureView = this.context.getCurrentTexture().createView();
    const presentPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    presentPass.setPipeline(this.presentPipeline);
    presentPass.setBindGroup(0, this.presentBindGroup);
    presentPass.draw(3, 1, 0, 0);
    presentPass.end();

    this.device.queue.submit([commandEncoder.finish()]);

    // Flip ping-pong
    this.step_ = 1 - this.step_;
  }

  getFPS(): number {
    return this.currentFps;
  }

  getParticleCount(): number {
    return this.particleCount;
  }

  async resetParticles(count?: number): Promise<void> {
    if (count !== undefined && count !== this.particleCount) {
      this.particleCount = count;
      // Recreate buffers for new count
      this.particleBuffers[0].destroy();
      this.particleBuffers[1].destroy();
      this.createParticleBuffers();
      this.createBindGroups();
    }
    this.initParticles();
    this.step_ = 0;
    this.simTime = 0;
    this.clearTrailTextures();
  }

  destroy(): void {
    this.particleBuffers[0]?.destroy();
    this.particleBuffers[1]?.destroy();
    this.uniformBuffer?.destroy();
    this.renderParamsBuffer?.destroy();
    this.trailParamsBuffer?.destroy();
    this.trailTexture?.destroy();
    this.device?.destroy();
  }
}
