"use client";

import { useEffect, useRef } from "react";
import type { DetectionBox } from "@/hooks/useObjectDetection";

const BOX_COLORS = [
  "#C2724E", // accent
  "#5A9A6E", // success
  "#C4903A", // warning
  "#6B8EBF", // blue
  "#9B6BB0", // purple
  "#D45B5B", // recording/red
  "#4EADC2", // teal
  "#C26BAA", // pink
];

interface DetectionCanvasProps {
  detections: DetectionBox[];
  imageWidth: number;
  imageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function DetectionCanvas({
  detections,
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const scaleX = canvasWidth / imageWidth;
    const scaleY = canvasHeight / imageHeight;

    // Track label colors by label name for consistency
    const labelColorMap = new Map<string, string>();
    let colorIndex = 0;

    detections.forEach((det) => {
      if (!labelColorMap.has(det.label)) {
        labelColorMap.set(det.label, BOX_COLORS[colorIndex % BOX_COLORS.length]);
        colorIndex++;
      }
      const color = labelColorMap.get(det.label)!;

      // The box coordinates are percentages (0-1) when percentage:true
      const x = det.box.xmin * imageWidth * scaleX;
      const y = det.box.ymin * imageHeight * scaleY;
      const w = (det.box.xmax - det.box.xmin) * imageWidth * scaleX;
      const h = (det.box.ymax - det.box.ymin) * imageHeight * scaleY;

      // Draw box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);

      // Draw label background
      const label = `${det.label} ${(det.score * 100).toFixed(0)}%`;
      ctx.font = "600 13px 'DM Sans', sans-serif";
      const textMetrics = ctx.measureText(label);
      const textHeight = 20;
      const padding = 6;
      const labelY = y > textHeight + 4 ? y - textHeight - 4 : y;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, labelY, textMetrics.width + padding * 2, textHeight, 4);
      ctx.fill();

      // Draw label text
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(label, x + padding, labelY + 14);
    });
  }, [detections, imageWidth, imageHeight, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight }}
    />
  );
}
