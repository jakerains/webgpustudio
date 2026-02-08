"use client";

import { useCallback } from "react";
import { ParticleCanvas } from "@/components/particles/ParticleCanvas";
import { SimulationControls } from "@/components/particles/SimulationControls";
import { useParticleSimulator } from "@/hooks/useParticleSimulator";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";

export default function ParticleSimulatorPage() {
  const { isSupported, isChecking } = useWebGPUSupport();
  const sim = useParticleSimulator();

  const handleInit = useCallback(
    (canvas: HTMLCanvasElement) => {
      sim.init(canvas);
    },
    [sim.init]
  );

  const handleResize = useCallback(
    (width: number, height: number) => {
      sim.handleResize(width, height);
    },
    [sim.handleResize]
  );

  const handleGravityWell = useCallback(
    (x: number, y: number, active: boolean) => {
      sim.setGravityWell(x, y, active);
    },
    [sim.setGravityWell]
  );

  const handleParticleCountChange = useCallback(
    (count: number) => {
      sim.resetParticles(count);
    },
    [sim.resetParticles]
  );

  const handleReset = useCallback(() => {
    sim.resetParticles();
  }, [sim.resetParticles]);

  // Loading state
  if (isChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div
            className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-3"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Checking WebGPU support...
          </p>
        </div>
      </main>
    );
  }

  // WebGPU not supported
  if (!isSupported) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5">
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--error-border)" }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: "var(--error)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: "var(--foreground)", fontFamily: "var(--font-display)" }}
          >
            WebGPU Required
          </h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            The particle simulator requires WebGPU compute shaders. Please use a browser that supports
            WebGPU, such as Chrome 113+ or Edge 113+.
          </p>
        </div>
      </main>
    );
  }

  // Error state
  if (sim.error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5">
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
          }}
        >
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: "var(--foreground)", fontFamily: "var(--font-display)" }}
          >
            Initialization Error
          </h2>
          <p className="text-sm" style={{ color: "var(--error)" }}>
            {sim.error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 top-[calc(1rem*4+1px)]" style={{ background: "#120D08" }}>
      {/* Title overlay */}
      <div
        className="absolute top-4 left-4 px-4 py-2 rounded-xl"
        style={{
          background: "rgba(254, 251, 246, 0.92)",
          border: "1px solid var(--card-border)",
          boxShadow: "var(--card-shadow)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 10,
        }}
      >
        <h1
          className="text-base font-bold"
          style={{ color: "var(--foreground)", fontFamily: "var(--font-display)" }}
        >
          Particle Simulator
        </h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          WebGPU Compute Shaders
        </p>
      </div>

      {/* Canvas */}
      <ParticleCanvas
        onInit={handleInit}
        onResize={handleResize}
        onGravityWell={handleGravityWell}
      />

      {/* Controls */}
      {sim.isInitialized && (
        <SimulationControls
          particleCount={sim.particleCount}
          gravity={sim.gravity}
          friction={sim.friction}
          colorMode={sim.colorMode}
          fps={sim.fps}
          onParticleCountChange={handleParticleCountChange}
          onGravityChange={sim.setGravity}
          onFrictionChange={sim.setFriction}
          onColorModeChange={sim.setColorMode}
          onReset={handleReset}
        />
      )}
    </main>
  );
}
