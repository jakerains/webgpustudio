"use client";

import { useRef, useEffect, useCallback } from "react";

interface MaskData {
  data: number[];
  width: number;
  height: number;
}

interface ClickPoint {
  x: number;
  y: number;
  label: 0 | 1;
}

interface SegmentCanvasProps {
  imageSrc: string | null;
  mask: MaskData | null; // Single selected mask (not array)
  points: ClickPoint[];
  onImageClick: (point: ClickPoint) => void;
  width: number;
  height: number;
  score?: number;
}

// Accent color for the mask overlay
const MASK_COLOR = [59, 130, 246]; // blue-500
const POSITIVE_COLOR = [59, 130, 246]; // blue for include
const NEGATIVE_COLOR = [239, 68, 68]; // red for exclude

export function SegmentCanvas({
  imageSrc,
  mask,
  points,
  onImageClick,
  width,
  height,
  score,
}: SegmentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the base image
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }

    if (mask) {
      // --- Dimmed background outside mask ---
      // Create a full-canvas dark overlay, then "cut out" the mask area
      const dimCanvas = document.createElement("canvas");
      dimCanvas.width = canvas.width;
      dimCanvas.height = canvas.height;
      const dimCtx = dimCanvas.getContext("2d")!;

      // Fill with semi-transparent black (dims the background)
      dimCtx.fillStyle = "rgba(0, 0, 0, 0.45)";
      dimCtx.fillRect(0, 0, dimCanvas.width, dimCanvas.height);

      // Create mask at native resolution, then scale
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = mask.width;
      maskCanvas.height = mask.height;
      const maskCtx = maskCanvas.getContext("2d")!;
      const maskImageData = maskCtx.createImageData(mask.width, mask.height);
      for (let i = 0; i < mask.data.length; i++) {
        if (mask.data[i] > 0) {
          maskImageData.data[i * 4] = 255;
          maskImageData.data[i * 4 + 1] = 255;
          maskImageData.data[i * 4 + 2] = 255;
          maskImageData.data[i * 4 + 3] = 255;
        }
      }
      maskCtx.putImageData(maskImageData, 0, 0);

      // Cut out the mask region from the dim layer using destination-out
      dimCtx.globalCompositeOperation = "destination-out";
      dimCtx.drawImage(maskCanvas, 0, 0, dimCanvas.width, dimCanvas.height);

      // Apply the dimmed overlay to the main canvas
      ctx.drawImage(dimCanvas, 0, 0);

      // --- Colored mask fill (subtle) ---
      const fillCanvas = document.createElement("canvas");
      fillCanvas.width = mask.width;
      fillCanvas.height = mask.height;
      const fillCtx = fillCanvas.getContext("2d")!;
      const fillData = fillCtx.createImageData(mask.width, mask.height);
      for (let i = 0; i < mask.data.length; i++) {
        if (mask.data[i] > 0) {
          fillData.data[i * 4] = MASK_COLOR[0];
          fillData.data[i * 4 + 1] = MASK_COLOR[1];
          fillData.data[i * 4 + 2] = MASK_COLOR[2];
          fillData.data[i * 4 + 3] = 50; // Very subtle tint
        }
      }
      fillCtx.putImageData(fillData, 0, 0);
      ctx.drawImage(fillCanvas, 0, 0, canvas.width, canvas.height);

      // --- Edge contour ---
      // Detect edges in the mask and draw them as a bright outline
      const edgeCanvas = document.createElement("canvas");
      edgeCanvas.width = mask.width;
      edgeCanvas.height = mask.height;
      const edgeCtx = edgeCanvas.getContext("2d")!;
      const edgeData = edgeCtx.createImageData(mask.width, mask.height);

      for (let y = 0; y < mask.height; y++) {
        for (let x = 0; x < mask.width; x++) {
          const idx = y * mask.width + x;
          if (mask.data[idx] <= 0) continue;

          // Check 4-connected neighbors — if any neighbor is outside or 0, this is an edge
          const isEdge =
            x === 0 || x === mask.width - 1 ||
            y === 0 || y === mask.height - 1 ||
            mask.data[idx - 1] <= 0 ||
            mask.data[idx + 1] <= 0 ||
            mask.data[idx - mask.width] <= 0 ||
            mask.data[idx + mask.width] <= 0;

          if (isEdge) {
            const pi = idx * 4;
            edgeData.data[pi] = MASK_COLOR[0];
            edgeData.data[pi + 1] = MASK_COLOR[1];
            edgeData.data[pi + 2] = MASK_COLOR[2];
            edgeData.data[pi + 3] = 255;
          }
        }
      }
      edgeCtx.putImageData(edgeData, 0, 0);

      // Draw edge scaled up — use a slightly thicker line by drawing twice with offset
      ctx.drawImage(edgeCanvas, 0, 0, canvas.width, canvas.height);

      // --- IoU score pill ---
      if (score !== undefined && score !== null) {
        const label = `${(score * 100).toFixed(1)}% confidence`;
        ctx.font = "bold 11px sans-serif";
        const metrics = ctx.measureText(label);
        const px = 6;
        const py = 4;
        const pillX = 8;
        const pillY = 8;

        ctx.fillStyle = `rgba(${MASK_COLOR[0]}, ${MASK_COLOR[1]}, ${MASK_COLOR[2]}, 0.9)`;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, metrics.width + px * 2, 18 + py, 6);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.fillText(label, pillX + px, pillY + 14);
      }
    }

    // --- Draw click points ---
    for (const p of points) {
      const scaleX = canvas.width / (imageRef.current?.naturalWidth || canvas.width);
      const scaleY = canvas.height / (imageRef.current?.naturalHeight || canvas.height);
      const cx = p.x * scaleX;
      const cy = p.y * scaleY;

      const isPositive = p.label === 1;
      const color = isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR;

      if (isPositive) {
        // Filled circle with white border for positive points
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Plus sign
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy);
        ctx.lineTo(cx + 3, cy);
        ctx.moveTo(cx, cy - 3);
        ctx.lineTo(cx, cy + 3);
        ctx.stroke();
      } else {
        // X mark with circle for negative points
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // X mark
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - 3);
        ctx.lineTo(cx + 3, cy + 3);
        ctx.moveTo(cx + 3, cy - 3);
        ctx.lineTo(cx - 3, cy + 3);
        ctx.stroke();
      }
    }
  }, [mask, points, score]);

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

  // Redraw on mask/points change
  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const displayScaleX = canvas.width / rect.width;
    const displayScaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * displayScaleX;
    const canvasY = (e.clientY - rect.top) * displayScaleY;

    // Convert canvas coords to original image coords
    const scaleX = imageRef.current.naturalWidth / canvas.width;
    const scaleY = imageRef.current.naturalHeight / canvas.height;

    onImageClick({
      x: Math.round(canvasX * scaleX),
      y: Math.round(canvasY * scaleY),
      label: 1, // Left-click = positive
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent browser context menu
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const displayScaleX = canvas.width / rect.width;
    const displayScaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * displayScaleX;
    const canvasY = (e.clientY - rect.top) * displayScaleY;

    const scaleX = imageRef.current.naturalWidth / canvas.width;
    const scaleY = imageRef.current.naturalHeight / canvas.height;

    onImageClick({
      x: Math.round(canvasX * scaleX),
      y: Math.round(canvasY * scaleY),
      label: 0, // Right-click = negative (exclude)
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className="cursor-crosshair rounded-xl"
      style={{
        border: "1px solid var(--border-subtle)",
        maxWidth: "100%",
        height: "auto",
      }}
    />
  );
}
