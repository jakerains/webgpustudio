"use client";

import { useEffect, useRef, useCallback } from "react";

interface ParticleCanvasProps {
  onInit: (canvas: HTMLCanvasElement) => void;
  onResize: (width: number, height: number) => void;
  onPointer: (x: number, y: number, active: boolean) => void;
}

export function ParticleCanvas({ onInit, onResize, onPointer }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  const getPointerPosition = useCallback(
    (canvas: HTMLCanvasElement, e: React.PointerEvent<HTMLCanvasElement>) => {
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      return {
        x: e.nativeEvent.offsetX * scaleX,
        y: (canvas.clientHeight - e.nativeEvent.offsetY) * scaleY,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = getPointerPosition(canvas, e);
      onPointer(
        x,
        y,
        true
      );
    },
    [getPointerPosition, onPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = getPointerPosition(canvas, e);
      onPointer(
        x,
        y,
        true
      );
    },
    [getPointerPosition, onPointer]
  );

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = getPointerPosition(canvas, e);
      onPointer(
        x,
        y,
        true
      );
    },
    [getPointerPosition, onPointer]
  );

  const handlePointerUp = useCallback(() => {
    onPointer(0, 0, false);
  }, [onPointer]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.floor(width * dpr);
        const h = Math.floor(height * dpr);

        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        if (!initializedRef.current) {
          initializedRef.current = true;
          onInit(canvas);
        } else {
          onResize(w, h);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [onInit, onResize]);

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
