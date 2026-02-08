"use client";

import { Activity } from "lucide-react";

interface PerformanceDisplayProps {
  fps?: number;
  inferenceTime?: number;
  tokensPerSec?: number;
  label?: string;
}

export function PerformanceDisplay({
  fps,
  inferenceTime,
  tokensPerSec,
  label,
}: PerformanceDisplayProps) {
  return (
    <div
      className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <Activity className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
      {label && <span style={{ color: "var(--muted)" }}>{label}</span>}
      {fps !== undefined && (
        <span style={{ color: "var(--success)" }}>{fps.toFixed(0)} FPS</span>
      )}
      {inferenceTime !== undefined && (
        <span style={{ color: "var(--warning)" }}>{inferenceTime.toFixed(0)} ms</span>
      )}
      {tokensPerSec !== undefined && (
        <span style={{ color: "var(--accent)" }}>{tokensPerSec.toFixed(1)} tok/s</span>
      )}
    </div>
  );
}
