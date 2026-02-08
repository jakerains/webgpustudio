"use client";

import { useRef, useEffect, useCallback } from "react";

const MASK_COLORS = [
  [255, 0, 0],     // red
  [0, 128, 255],   // blue
  [0, 200, 0],     // green
  [255, 165, 0],   // orange
  [128, 0, 255],   // purple
  [255, 255, 0],   // yellow
  [0, 200, 200],   // cyan
  [255, 0, 128],   // pink
];

interface MaskData {
  data: number[];
  width: number;
  height: number;
}

interface SegmentCanvasProps {
  imageSrc: string | null;
  masks: MaskData[];
  points: Array<{ x: number; y: number }>;
  onImageClick: (point: { x: number; y: number }) => void;
  width: number;
  height: number;
  scores?: number[];
}

export function SegmentCanvas({
  imageSrc,
  masks,
  points,
  onImageClick,
  width,
  height,
  scores,
}: SegmentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Draw everything
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Draw masks with semi-transparency
    for (let m = 0; m < masks.length; m++) {
      const mask = masks[m];
      const color = MASK_COLORS[m % MASK_COLORS.length];
      const imageData = ctx.createImageData(mask.width, mask.height);

      for (let i = 0; i < mask.data.length; i++) {
        const val = mask.data[i];
        if (val > 0) {
          imageData.data[i * 4] = color[0];
          imageData.data[i * 4 + 1] = color[1];
          imageData.data[i * 4 + 2] = color[2];
          imageData.data[i * 4 + 3] = 100; // semi-transparent
        }
      }

      // Create a temporary canvas for the mask at original resolution
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = mask.width;
      tempCanvas.height = mask.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.putImageData(imageData, 0, 0);
        // Draw scaled to the display canvas
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      }
    }

    // Draw click points
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const color = MASK_COLORS[i % MASK_COLORS.length];

      // Scale point from image coords to canvas coords
      const scaleX = canvas.width / (imageRef.current?.naturalWidth || canvas.width);
      const scaleY = canvas.height / (imageRef.current?.naturalHeight || canvas.height);
      const cx = p.x * scaleX;
      const cy = p.y * scaleY;

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw IoU scores as overlay labels
    if (scores && scores.length > 0) {
      for (let i = 0; i < scores.length && i < masks.length; i++) {
        const score = scores[i];
        if (score === undefined || score === null) continue;

        const label = `IoU: ${(score * 100).toFixed(1)}%`;

        // Position the label near the top-left of the canvas, stacked per mask
        const labelX = 10;
        const labelY = 24 + i * 28;

        const color = MASK_COLORS[i % MASK_COLORS.length];

        ctx.font = "bold 13px sans-serif";
        const metrics = ctx.measureText(label);
        const padding = 4;

        // Background pill
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.85)`;
        ctx.beginPath();
        ctx.roundRect(
          labelX - padding,
          labelY - 13 - padding,
          metrics.width + padding * 2,
          18 + padding * 2,
          4
        );
        ctx.fill();

        // Text
        ctx.fillStyle = "#fff";
        ctx.fillText(label, labelX, labelY);
      }
    }
  }, [masks, points, scores]);

  // Load image when src changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
    img.src = imageSrc;
  }, [imageSrc, draw]);

  // Redraw on masks/points change
  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert canvas coords to original image coords
    const scaleX = imageRef.current.naturalWidth / canvas.width;
    const scaleY = imageRef.current.naturalHeight / canvas.height;

    onImageClick({
      x: Math.round(clickX * scaleX),
      y: Math.round(clickY * scaleY),
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      className="cursor-crosshair rounded-xl"
      style={{
        border: "1px solid var(--border-subtle)",
        maxWidth: "100%",
        height: "auto",
      }}
    />
  );
}
