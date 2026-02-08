"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ParticleEngine, PointerMode } from "@/lib/particle-engine";
import { PARTICLE_PRESETS, getParticlePreset } from "@/lib/particle-presets";

interface ParticleSimulatorState {
  isInitialized: boolean;
  fps: number;
  particleCount: number;
  presetId: string;
  trailFade: number;
  pointerMode: PointerMode;
  error: string | null;
}

export function useParticleSimulator() {
  const defaultPreset = PARTICLE_PRESETS[0];
  const [state, setState] = useState<ParticleSimulatorState>({
    isInitialized: false,
    fps: 0,
    particleCount: 10000,
    presetId: defaultPreset?.id ?? "ink-drift",
    trailFade: defaultPreset?.params.trailFade ?? 0.1,
    pointerMode: "attract",
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
        const preset = getParticlePreset(state.presetId);
        engine.setParams({
          ...preset.params,
          trailFade: state.trailFade,
          pointerMode: state.pointerMode,
        });

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
    [state.particleCount, state.presetId, state.trailFade, state.pointerMode, animate]
  );

  const setPointer = useCallback((x: number, y: number, active: boolean) => {
    engineRef.current?.setPointer(x, y, active);
  }, []);

  const setPreset = useCallback((presetId: string) => {
    const preset = getParticlePreset(presetId);
    setState((prev) => ({
      ...prev,
      presetId: preset.id,
      trailFade: preset.params.trailFade,
    }));
    engineRef.current?.setParams(preset.params);
  }, []);

  const setTrailFade = useCallback((trailFade: number) => {
    setState((prev) => ({ ...prev, trailFade }));
    engineRef.current?.setParams({ trailFade });
  }, []);

  const setPointerMode = useCallback((pointerMode: PointerMode) => {
    setState((prev) => ({ ...prev, pointerMode }));
    engineRef.current?.setParams({ pointerMode });
  }, []);

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
    setPointer,
    setPreset,
    setTrailFade,
    setPointerMode,
    resetParticles,
    handleResize,
  };
}
