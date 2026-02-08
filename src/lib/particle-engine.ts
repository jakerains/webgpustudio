import { computeShader, vertexShader, fragmentShader } from "./particle-shaders";

// Stride: pos(2) + vel(2) + color(4) = 8 floats per particle
const PARTICLE_STRIDE = 8;
const FLOATS_PER_F32 = 4; // bytes

export type ColorMode = "rainbow" | "temperature" | "monochrome";

const COLOR_MODE_MAP: Record<ColorMode, number> = {
  rainbow: 0,
  temperature: 1,
  monochrome: 2,
};

// Uniform layout: deltaTime, gravity, friction, numParticles, mouseX, mouseY, mouseActive, boundaryX, boundaryY, colorMode, time, _pad
const UNIFORM_SIZE = 12 * FLOATS_PER_F32; // 12 floats, 48 bytes

export class ParticleEngine {
  private canvas: HTMLCanvasElement;
  private particleCount: number;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  // Buffers
  private particleBuffers!: [GPUBuffer, GPUBuffer]; // ping-pong
  private uniformBuffer!: GPUBuffer;
  private canvasSizeBuffer!: GPUBuffer;

  // Pipelines
  private computePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;

  // Bind groups
  private computeBindGroups!: [GPUBindGroup, GPUBindGroup]; // ping-pong
  private renderBindGroups!: [GPUBindGroup, GPUBindGroup]; // ping-pong

  private step_: number = 0; // tracks which ping-pong buffer is current
  private lastTime: number = 0;
  private frameCount: number = 0;
  private fpsTime: number = 0;
  private currentFps: number = 0;
  private simTime: number = 0;

  // Simulation parameters
  private gravity: number = 1.0;
  private friction: number = 0.985;
  private colorMode: ColorMode = "rainbow";
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
    this.initParticles();

    this.lastTime = performance.now();
    this.fpsTime = performance.now();
  }

  private createBuffers(): void {
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

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.canvasSizeBuffer = this.device.createBuffer({
      size: 2 * FLOATS_PER_F32, // width, height
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
          { binding: 1, resource: { buffer: this.canvasSizeBuffer } },
        ],
      }),
      this.device.createBindGroup({
        layout: renderLayout,
        entries: [
          { binding: 0, resource: { buffer: this.particleBuffers[0] } },
          { binding: 1, resource: { buffer: this.canvasSizeBuffer } },
        ],
      }),
    ];
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

  setGravityWell(x: number, y: number, active: boolean): void {
    this.mouseX = x;
    this.mouseY = y;
    this.mouseActive = active;
  }

  setParams(gravity: number, friction: number, colorMode: ColorMode): void {
    this.gravity = gravity;
    this.friction = friction;
    this.colorMode = colorMode;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });
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
    const uniforms = new Float32Array(12);
    uniforms[0] = deltaTime;
    uniforms[1] = this.gravity;
    uniforms[2] = this.friction;
    // numParticles as uint32 reinterpreted
    new Uint32Array(uniforms.buffer, 12, 1)[0] = this.particleCount;
    uniforms[4] = this.mouseX;
    uniforms[5] = this.mouseY;
    uniforms[6] = this.mouseActive ? 1.0 : 0.0;
    uniforms[7] = this.canvas.width;
    uniforms[8] = this.canvas.height;
    new Uint32Array(uniforms.buffer, 36, 1)[0] = COLOR_MODE_MAP[this.colorMode];
    uniforms[10] = this.simTime;
    uniforms[11] = 0; // padding

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    // Update canvas size uniform
    const canvasSize = new Float32Array([this.canvas.width, this.canvas.height]);
    this.device.queue.writeBuffer(this.canvasSizeBuffer, 0, canvasSize);

    const commandEncoder = this.device.createCommandEncoder();

    // Compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroups[this.step_]);
    computePass.dispatchWorkgroups(Math.ceil(this.particleCount / 64));
    computePass.end();

    // Render pass
    const textureView = this.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.07, g: 0.05, b: 0.03, a: 1.0 }, // dark warm background
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroups[this.step_]);
    // 6 vertices per quad (2 triangles), instanced for each particle
    renderPass.draw(6, this.particleCount, 0, 0);
    renderPass.end();

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
      this.createBuffers();
      this.createBindGroups();
    }
    this.initParticles();
    this.step_ = 0;
    this.simTime = 0;
  }

  destroy(): void {
    this.particleBuffers[0]?.destroy();
    this.particleBuffers[1]?.destroy();
    this.uniformBuffer?.destroy();
    this.canvasSizeBuffer?.destroy();
    this.device?.destroy();
  }
}
