"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ParticleEngine, ColorMode } from "@/lib/particle-engine";

interface ParticleSimulatorState {
  isInitialized: boolean;
  fps: number;
  particleCount: number;
  gravity: number;
  friction: number;
  colorMode: ColorMode;
  error: string | null;
}

export function useParticleSimulator() {
  const [state, setState] = useState<ParticleSimulatorState>({
    isInitialized: false,
    fps: 0,
    particleCount: 10000,
    gravity: 1.0,
    friction: 0.985,
    colorMode: "rainbow",
    error: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const runningRef = useRef<boolean>(false);

  const animate = useCallback(() => {
    if (!runningRef.current || !engineRef.current) return;

    engineRef.current.step();

    // Update FPS every frame for display
    setState((prev) => ({
      ...prev,
      fps: engineRef.current?.getFPS() ?? 0,
    }));

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const init = useCallback(
    async (canvas: HTMLCanvasElement) => {
      canvasRef.current = canvas;

      try {
        const engine = new ParticleEngine(canvas, state.particleCount);
        await engine.init();
        engine.setParams(state.gravity, state.friction, state.colorMode);

        engineRef.current = engine;
        runningRef.current = true;

        setState((prev) => ({ ...prev, isInitialized: true, error: null }));

        animFrameRef.current = requestAnimationFrame(animate);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to initialize WebGPU",
        }));
      }
    },
    [state.particleCount, state.gravity, state.friction, state.colorMode, animate]
  );

  const setGravityWell = useCallback((x: number, y: number, active: boolean) => {
    engineRef.current?.setGravityWell(x, y, active);
  }, []);

  const setGravity = useCallback((gravity: number) => {
    setState((prev) => ({ ...prev, gravity }));
    engineRef.current?.setParams(
      gravity,
      engineRef.current ? state.friction : 0.985,
      engineRef.current ? state.colorMode : "rainbow"
    );
  }, [state.friction, state.colorMode]);

  const setFriction = useCallback((friction: number) => {
    setState((prev) => ({ ...prev, friction }));
    engineRef.current?.setParams(
      state.gravity,
      friction,
      state.colorMode
    );
  }, [state.gravity, state.colorMode]);

  const setColorMode = useCallback((colorMode: ColorMode) => {
    setState((prev) => ({ ...prev, colorMode }));
    engineRef.current?.setParams(state.gravity, state.friction, colorMode);
  }, [state.gravity, state.friction]);

  const resetParticles = useCallback(async (count?: number) => {
    if (!engineRef.current) return;

    const newCount = count ?? state.particleCount;
    await engineRef.current.resetParticles(newCount);
    setState((prev) => ({
      ...prev,
      particleCount: newCount,
    }));
  }, [state.particleCount]);

  const handleResize = useCallback((width: number, height: number) => {
    engineRef.current?.resize(width, height);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  return {
    ...state,
    canvasRef,
    init,
    setGravityWell,
    setGravity,
    setFriction,
    setColorMode,
    resetParticles,
    handleResize,
  };
}
