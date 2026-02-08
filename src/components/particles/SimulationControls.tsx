"use client";

import { ColorMode } from "@/lib/particle-engine";

interface SimulationControlsProps {
  particleCount: number;
  gravity: number;
  friction: number;
  colorMode: ColorMode;
  fps: number;
  onParticleCountChange: (count: number) => void;
  onGravityChange: (gravity: number) => void;
  onFrictionChange: (friction: number) => void;
  onColorModeChange: (mode: ColorMode) => void;
  onReset: () => void;
}

const PARTICLE_PRESETS = [1000, 5000, 10000, 50000];
const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: "rainbow", label: "Rainbow" },
  { value: "temperature", label: "Thermal" },
  { value: "monochrome", label: "Ember" },
];

export function SimulationControls({
  particleCount,
  gravity,
  friction,
  colorMode,
  fps,
  onParticleCountChange,
  onGravityChange,
  onFrictionChange,
  onColorModeChange,
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

      {/* Particle Count */}
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted)" }}>
          Particles
        </label>
        <div className="grid grid-cols-4 gap-1">
          {PARTICLE_PRESETS.map((count) => (
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

      {/* Gravity Slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Gravity
          </label>
          <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>
            {gravity.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={gravity}
          onChange={(e) => onGravityChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((gravity - 0.1) / 4.9) * 100}%, var(--border-subtle) ${((gravity - 0.1) / 4.9) * 100}%, var(--border-subtle) 100%)`,
            accentColor: "var(--accent)",
          }}
        />
      </div>

      {/* Friction Slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            Friction
          </label>
          <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>
            {friction.toFixed(3)}
          </span>
        </div>
        <input
          type="range"
          min="0.950"
          max="1.000"
          step="0.001"
          value={friction}
          onChange={(e) => onFrictionChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((friction - 0.95) / 0.05) * 100}%, var(--border-subtle) ${((friction - 0.95) / 0.05) * 100}%, var(--border-subtle) 100%)`,
            accentColor: "var(--accent)",
          }}
        />
      </div>

      {/* Color Mode */}
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--muted)" }}>
          Color Mode
        </label>
        <div className="grid grid-cols-3 gap-1">
          {COLOR_MODES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onColorModeChange(value)}
              className="text-xs py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: colorMode === value ? "var(--accent)" : "var(--surface)",
                color: colorMode === value ? "#FFFFFF" : "var(--foreground)",
                border: `1px solid ${colorMode === value ? "var(--accent)" : "var(--border-subtle)"}`,
              }}
            >
              {label}
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
        Click & hold to attract particles
      </p>
    </div>
  );
}
