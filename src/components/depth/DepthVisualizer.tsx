"use client";

import { useRef, useEffect } from "react";

export type ColorScheme = "grayscale" | "thermal" | "rainbow";

interface DepthVisualizerProps {
  originalSrc: string;
  depthData: { width: number; height: number; values: number[] };
  colorScheme: ColorScheme;
}

function depthToGrayscale(value: number): [number, number, number] {
  const v = Math.round(value * 255);
  return [v, v, v];
}

function depthToThermal(value: number): [number, number, number] {
  // blue -> cyan -> green -> yellow -> red
  let r: number, g: number, b: number;
  if (value < 0.25) {
    const t = value / 0.25;
    r = 0;
    g = Math.round(t * 255);
    b = 255;
  } else if (value < 0.5) {
    const t = (value - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = Math.round((1 - t) * 255);
  } else if (value < 0.75) {
    const t = (value - 0.5) / 0.25;
    r = Math.round(t * 255);
    g = 255;
    b = 0;
  } else {
    const t = (value - 0.75) / 0.25;
    r = 255;
    g = Math.round((1 - t) * 255);
    b = 0;
  }
  return [r, g, b];
}

function depthToRainbow(value: number): [number, number, number] {
  // Full HSL hue rotation (0 -> 360)
  const hue = value * 360;
  const s = 1;
  const l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

const COLOR_FN: Record<
  ColorScheme,
  (v: number) => [number, number, number]
> = {
  grayscale: depthToGrayscale,
  thermal: depthToThermal,
  rainbow: depthToRainbow,
};

export function DepthVisualizer({
  originalSrc,
  depthData,
  colorScheme,
}: DepthVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, values } = depthData;
    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    const colorFn = COLOR_FN[colorScheme];

    for (let i = 0; i < values.length; i++) {
      const [r, g, b] = colorFn(values[i]);
      const offset = i * 4;
      imageData.data[offset] = r;
      imageData.data[offset + 1] = g;
      imageData.data[offset + 2] = b;
      imageData.data[offset + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [depthData, colorScheme]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
      <div>
        <p
          className="text-xs font-medium mb-2"
          style={{ color: "var(--muted)" }}
        >
          Original
        </p>
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: "var(--card-border)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalSrc}
            alt="Original"
            className="w-full h-auto block"
          />
        </div>
      </div>
      <div>
        <p
          className="text-xs font-medium mb-2"
          style={{ color: "var(--muted)" }}
        >
          Depth Map
        </p>
        <div
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: "var(--card-border)" }}
        >
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>
      </div>
    </div>
  );
}
