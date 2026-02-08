"use client";

import { useState, useRef, useCallback } from "react";

interface ComparisonSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function ComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
}: ComparisonSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    updatePosition(e.clientX);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) updatePosition(e.clientX);
    },
    [updatePosition]
  );

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    updatePosition(e.touches[0].clientX);
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDragging.current) updatePosition(e.touches[0].clientX);
    },
    [updatePosition]
  );

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden cursor-col-resize select-none"
      style={{ border: "1px solid var(--card-border)" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* After image (full width, background) */}
      <img src={afterSrc} alt={afterLabel} className="w-full block" style={{ background: "repeating-conic-gradient(#e0e0e0 0% 25%, white 0% 50%) 50% / 20px 20px" }} />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="w-full h-full object-cover"
          style={{ minWidth: containerRef.current?.offsetWidth }}
        />
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5"
        style={{ left: `${position}%`, background: "white", boxShadow: "0 0 8px rgba(0,0,0,0.3)" }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            left: "50%",
          }}
        >
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 rounded-full" style={{ background: "var(--muted)" }} />
            <div className="w-0.5 h-3 rounded-full" style={{ background: "var(--muted)" }} />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div
        className="absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-semibold"
        style={{ background: "rgba(0,0,0,0.5)", color: "white" }}
      >
        {beforeLabel}
      </div>
      <div
        className="absolute top-3 right-3 px-2 py-1 rounded-md text-[10px] font-semibold"
        style={{ background: "rgba(0,0,0,0.5)", color: "white" }}
      >
        {afterLabel}
      </div>
    </div>
  );
}
