"use client";

import { useState, useEffect } from "react";

interface GenerationProgressProps {
  isGenerating: boolean;
}

export function GenerationProgress({ isGenerating }: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setElapsed(0);
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!isGenerating) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr =
    minutes > 0
      ? `${minutes}:${seconds.toString().padStart(2, "0")}`
      : `${seconds}s`;

  return (
    <div
      className="rounded-xl p-5 text-center animate-fade-in-up"
      style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="flex justify-center mb-3">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1.5 rounded-full"
              style={{
                background: "var(--accent)",
                height: "20px",
                animation: `musicBar 1s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <div
        className="text-sm font-medium animate-shimmer"
        style={{
          color: "var(--foreground)",
          backgroundImage:
            "linear-gradient(90deg, var(--foreground), var(--accent), var(--foreground))",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Composing music...
      </div>

      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
        Elapsed: {timeStr}
      </div>

      <style>{`
        @keyframes musicBar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
