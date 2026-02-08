"use client";

import { PointerMode } from "@/lib/particle-engine";
import { PARTICLE_PRESETS } from "@/lib/particle-presets";

interface SimulationControlsProps {
  particleCount: number;
  presetId: string;
  trailFade: number;
  pointerMode: PointerMode;
  fps: number;
  onParticleCountChange: (count: number) => void;
  onPresetChange: (presetId: string) => void;
  onTrailFadeChange: (trailFade: number) => void;
  onPointerModeChange: (mode: PointerMode) => void;
  onReset: () => void;
}

const PARTICLE_COUNTS = [1000, 5000, 10000, 50000];
const TRAIL_MIN = 0.02;
const TRAIL_MAX = 0.18;

export function SimulationControls({
  particleCount,
  presetId,
  trailFade,
  pointerMode,
  fps,
  onParticleCountChange,
  onPresetChange,
  onTrailFadeChange,
  onPointerModeChange,
  onReset,
}: SimulationControlsProps) {
  return (
    <div
      className="absolute top-4 right-4 w-64 rounded-2xl p-4 space-y-4 select-none"
      style={{
        background: "rgba(254, 251, 246, 0.92)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--card-shadow)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--foreground)", fontFamily: "var(--font-display)" }}
        >
          Controls
        </h3>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded-full"
          style={{
            background: "var(--surface)",
            color: fps >= 55 ? "var(--success)" : fps >= 30 ? "var(--warning)" : "var(--error)",
          }}
        >
          {fps} FPS
        </span>
      </div>

      {/* Presets */}
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted)" }}>
          Preset
        </label>
        <div className="grid grid-cols-3 gap-1">
          {PARTICLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onPresetChange(preset.id)}
              className="text-xs py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: presetId === preset.id ? "var(--accent)" : "var(--surface)",
                color: presetId === preset.id ? "#FFFFFF" : "var(--foreground)",
                border: `1px solid ${presetId === preset.id ? "var(--accent)" : "var(--border-subtle)"}`,
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Particle Count */}
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted)" }}>
          Particles
        </label>
        <div className="grid grid-cols-4 gap-1">
          {PARTICLE_COUNTS.map((count) => (
            <button
              key={count}
              onClick={() => onParticleCountChange(count)}
              className="text-xs py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: particleCount === count ? "var(--accent)" : "var(--surface)",
                color: particleCount === count ? "#FFFFFF" : "var(--foreground)",
                border: `1px solid ${particleCount === count ? "var(--accent)" : "var(--border-subtle)"}`,
              }}
            >
              {count >= 1000 ? `${count / 1000}k` : count}
            </button>
          ))}
        </div>
      </div>

      {/* Trail Fade */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Trail
          </label>
          <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>
            {trailFade.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={TRAIL_MIN}
          max={TRAIL_MAX}
          step={0.01}
          value={trailFade}
          onChange={(e) => onTrailFadeChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((trailFade - TRAIL_MIN) / (TRAIL_MAX - TRAIL_MIN)) * 100}%, var(--border-subtle) ${((trailFade - TRAIL_MIN) / (TRAIL_MAX - TRAIL_MIN)) * 100}%, var(--border-subtle) 100%)`,
            accentColor: "var(--accent)",
          }}
        />
      </div>

      {/* Pointer Mode */}
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted)" }}>
          Pointer
        </label>
        <div className="grid grid-cols-2 gap-1">
          {(["attract", "repel"] as PointerMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onPointerModeChange(mode)}
              className="text-xs py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: pointerMode === mode ? "var(--accent)" : "var(--surface)",
                color: pointerMode === mode ? "#FFFFFF" : "var(--foreground)",
                border: `1px solid ${pointerMode === mode ? "var(--accent)" : "var(--border-subtle)"}`,
              }}
            >
              {mode === "attract" ? "Attract" : "Repel"}
            </button>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="w-full text-xs py-2 rounded-lg font-medium transition-all"
        style={{
          background: "var(--surface)",
          color: "var(--foreground)",
          border: "1px solid var(--border-subtle)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--surface)";
        }}
      >
        Reset Simulation
      </button>

      {/* Hint */}
      <p className="text-xs text-center" style={{ color: "var(--muted-light)" }}>
        Move or drag to pull or push the ink
      </p>
    </div>
  );
}
