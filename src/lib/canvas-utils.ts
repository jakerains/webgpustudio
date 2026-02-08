/**
 * Canvas utility functions for bounding box drawing, mask overlay, and image resizing.
 */

export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface Detection {
  label: string;
  score: number;
  box: BoundingBox;
}

// Color palette for bounding boxes and masks
const COLORS = [
  "#C2724E", "#5A9A6E", "#C4903A", "#6B8EC2", "#C25454",
  "#8B6EC2", "#4EA8C2", "#C26B8E", "#7EC24E", "#C2A04E",
  "#4E6BC2", "#C24E8B", "#4EC28B", "#C2C24E", "#8BC24E",
  "#C24E4E", "#4EC2C2", "#C28B4E", "#4E8BC2", "#8B4EC2",
];

export function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/**
 * Draw bounding boxes with labels on a canvas.
 */
export function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  scaleX = 1,
  scaleY = 1
): void {
  detections.forEach((det, i) => {
    const color = getColor(i);
    const { xmin, ymin, xmax, ymax } = det.box;
    const x = xmin * scaleX;
    const y = ymin * scaleY;
    const w = (xmax - xmin) * scaleX;
    const h = (ymax - ymin) * scaleY;

    // Box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Label background
    const label = `${det.label} ${(det.score * 100).toFixed(0)}%`;
    ctx.font = "bold 12px sans-serif";
    const metrics = ctx.measureText(label);
    const labelH = 18;
    const labelW = metrics.width + 8;

    ctx.fillStyle = color;
    ctx.fillRect(x, y - labelH, labelW, labelH);

    // Label text
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(label, x + 4, y - 5);
  });
}

/**
 * Draw a semi-transparent colored mask overlay.
 */
export function drawMask(
  ctx: CanvasRenderingContext2D,
  maskData: number[],
  width: number,
  height: number,
  color: string,
  opacity = 0.4
): void {
  const imageData = ctx.createImageData(width, height);

  // Parse hex color
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  for (let i = 0; i < maskData.length; i++) {
    const alpha = maskData[i] > 0.5 ? Math.round(opacity * 255) : 0;
    imageData.data[i * 4] = r;
    imageData.data[i * 4 + 1] = g;
    imageData.data[i * 4 + 2] = b;
    imageData.data[i * 4 + 3] = alpha;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Resize an image to fit within max dimensions while maintaining aspect ratio.
 */
export function resizeImage(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number
): { canvas: HTMLCanvasElement; width: number; height: number } {
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  width = Math.round(width);
  height = Math.round(height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  return { canvas, width, height };
}

/**
 * Convert a canvas to a data URL with optional format/quality.
 */
export function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  format: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  quality = 0.92
): string {
  return canvas.toDataURL(format, quality);
}

/**
 * Convert Float32Array audio data to a WAV blob.
 */
export function float32ToWav(audioData: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioData.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Audio data
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
