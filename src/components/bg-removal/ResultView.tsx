"use client";

import { useState, useRef, useCallback } from "react";
import { Download, GripVertical } from "lucide-react";

interface ResultViewProps {
  originalSrc: string;
  resultSrc: string;
  onDownload: () => void;
}

export function ResultView({ originalSrc, resultSrc, onDownload }: ResultViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => handleMove(e.clientX),
    [handleMove]
  );

  return (
    <div className="space-y-4">
      {/* Comparison slider */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden select-none cursor-col-resize"
        style={{ border: "1px solid var(--card-border)" }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        {/* Result (background removed) — full width behind */}
        <div className="relative w-full">
          {/* Checkerboard background to show transparency */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #e0d8cc 25%, transparent 25%), linear-gradient(-45deg, #e0d8cc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0d8cc 75%), linear-gradient(-45deg, transparent 75%, #e0d8cc 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          />
          <img
            src={resultSrc}
            alt="Background removed"
            className="relative block w-full h-auto"
            draggable={false}
          />
        </div>

        {/* Original — clipped by slider position */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={originalSrc}
            alt="Original"
            className="block w-full h-auto"
            style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100%" }}
            draggable={false}
          />
        </div>

        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{
            left: `${sliderPos}%`,
            background: "var(--card)",
            boxShadow: "0 0 4px rgba(0,0,0,0.3)",
          }}
        />

        {/* Slider handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-8 rounded-full"
          style={{
            left: `${sliderPos}%`,
            background: "var(--card)",
            border: "2px solid var(--accent)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <GripVertical className="w-4 h-4" style={{ color: "var(--accent)" }} />
        </div>

        {/* Labels */}
        <div
          className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-medium"
          style={{
            background: "rgba(45, 36, 24, 0.7)",
            color: "#fff",
            backdropFilter: "blur(4px)",
          }}
        >
          Original
        </div>
        <div
          className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-medium"
          style={{
            background: "rgba(45, 36, 24, 0.7)",
            color: "#fff",
            backdropFilter: "blur(4px)",
          }}
        >
          Removed
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={onDownload}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99]"
        style={{
          background: "var(--accent)",
          color: "#FFFFFF",
          boxShadow: "0 2px 12px rgba(194, 114, 78, 0.3)",
        }}
      >
        <Download className="w-4 h-4" />
        Download PNG
      </button>
    </div>
  );
}
