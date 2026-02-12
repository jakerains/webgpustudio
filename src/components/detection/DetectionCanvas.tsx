"use client";

import { useEffect, useRef } from "react";
import type { DetectionBox } from "@/hooks/useObjectDetection";

// ── Palette ──────────────────────────────────────────────────────────────────
const COLORS = [
  "#C2724E", "#5A9A6E", "#C4903A", "#6B8EBF",
  "#9B6BB0", "#D45B5B", "#4EADC2", "#C26BAA",
];

// ── Tracked-box type ─────────────────────────────────────────────────────────
interface TrackedBox {
  label: string;
  score: number;
  color: string;
  // current (smoothed) position
  x: number; y: number; w: number; h: number;
  // target position from the latest detection frame
  tx: number; ty: number; tw: number; th: number;
  opacity: number;
  targetOpacity: number;
  lastSeen: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(t, 1);
}

function boxIoU(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

// ── Component ────────────────────────────────────────────────────────────────
interface DetectionCanvasProps {
  detections: DetectionBox[];
  imageWidth: number;
  imageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function DetectionCanvas({
  detections,
  canvasWidth,
  canvasHeight,
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackedRef = useRef<TrackedBox[]>([]);
  const colorMapRef = useRef(new Map<string, string>());
  const colorIdxRef = useRef(0);
  const rafRef = useRef(0);

  // ── Update tracking when new detections arrive ─────────────────────────────
  useEffect(() => {
    const now = performance.now();
    const tracked = trackedRef.current;

    const incoming = detections.map((d) => ({
      label: d.label,
      score: d.score,
      x: d.box.xmin * canvasWidth,
      y: d.box.ymin * canvasHeight,
      w: (d.box.xmax - d.box.xmin) * canvasWidth,
      h: (d.box.ymax - d.box.ymin) * canvasHeight,
    }));

    const usedT = new Set<number>();
    const usedI = new Set<number>();

    // Greedy match: same label + best IoU
    for (let i = 0; i < incoming.length; i++) {
      let bestJ = -1;
      let bestIoU = 0.05;
      for (let j = 0; j < tracked.length; j++) {
        if (usedT.has(j) || tracked[j].label !== incoming[i].label) continue;
        const s = boxIoU(incoming[i], tracked[j]);
        if (s > bestIoU) {
          bestIoU = s;
          bestJ = j;
        }
      }
      if (bestJ >= 0) {
        tracked[bestJ].tx = incoming[i].x;
        tracked[bestJ].ty = incoming[i].y;
        tracked[bestJ].tw = incoming[i].w;
        tracked[bestJ].th = incoming[i].h;
        tracked[bestJ].score = incoming[i].score;
        tracked[bestJ].targetOpacity = 1;
        tracked[bestJ].lastSeen = now;
        usedT.add(bestJ);
        usedI.add(i);
      }
    }

    // New tracked boxes
    for (let i = 0; i < incoming.length; i++) {
      if (usedI.has(i)) continue;
      const d = incoming[i];
      if (!colorMapRef.current.has(d.label)) {
        colorMapRef.current.set(
          d.label,
          COLORS[colorIdxRef.current++ % COLORS.length],
        );
      }
      tracked.push({
        label: d.label,
        score: d.score,
        color: colorMapRef.current.get(d.label)!,
        x: d.x, y: d.y, w: d.w, h: d.h,
        tx: d.x, ty: d.y, tw: d.w, th: d.h,
        opacity: 0,
        targetOpacity: 1,
        lastSeen: now,
      });
    }

    // Fade out stale boxes (200ms persistence before fading)
    for (let j = 0; j < tracked.length; j++) {
      if (
        !usedT.has(j) &&
        tracked[j].targetOpacity > 0 &&
        now - tracked[j].lastSeen > 200
      ) {
        tracked[j].targetOpacity = 0;
      }
    }

    // Prune fully invisible boxes
    trackedRef.current = tracked.filter(
      (t) => t.opacity > 0.01 || t.targetOpacity > 0,
    );
  }, [detections, canvasWidth, canvasHeight]);

  // ── Continuous render loop with smooth interpolation ───────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasWidth <= 0 || canvasHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let prev = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Frame-rate-independent smoothing (exponential ease)
      const posRate = 1 - Math.pow(0.000001, dt); // position: snappy follow
      const fadeRate = 1 - Math.pow(0.001, dt); // opacity: gentle fade

      for (const b of trackedRef.current) {
        b.x = lerp(b.x, b.tx, posRate);
        b.y = lerp(b.y, b.ty, posRate);
        b.w = lerp(b.w, b.tw, posRate);
        b.h = lerp(b.h, b.th, posRate);
        b.opacity = lerp(b.opacity, b.targetOpacity, fadeRate);

        if (b.opacity < 0.02) continue;
        ctx.globalAlpha = b.opacity;
        drawDetection(ctx, b);
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight }}
    />
  );
}

// ── Drawing ──────────────────────────────────────────────────────────────────

function drawDetection(ctx: CanvasRenderingContext2D, box: TrackedBox) {
  const { x, y, w, h, color, label, score } = box;

  // ── Corner brackets (no full border — clean & modern) ──
  const cl = Math.max(12, Math.min(24, w * 0.2, h * 0.2));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x, y + cl);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cl, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - cl, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cl);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + h - cl);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cl, y + h);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w - cl, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cl);
  ctx.stroke();

  // ── Label pill ──
  const scoreText = `${(score * 100).toFixed(0)}%`;
  ctx.font = "500 11px 'DM Sans', system-ui, sans-serif";
  const labelW = ctx.measureText(label).width;
  const scoreW = ctx.measureText(scoreText).width;

  const dotR = 3;
  const px = 8;
  const gap = 6;
  const scoreGap = 6;
  const pillH = 20;
  const pillW = px + dotR * 2 + gap + labelW + scoreGap + scoreW + px;
  const pillX = x;
  const pillY = y > pillH + 6 ? y - pillH - 4 : y + h + 4;

  // Dark translucent background
  ctx.fillStyle = "rgba(10, 10, 10, 0.72)";
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 6);
  ctx.fill();

  // Colored dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pillX + px + dotR, pillY + pillH / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Label text
  const textX = pillX + px + dotR * 2 + gap;
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(label, textX, pillY + 14);

  // Score (dimmer)
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillText(scoreText, textX + labelW + scoreGap, pillY + 14);
}
