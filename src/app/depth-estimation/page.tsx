"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Camera, Video, RotateCcw, AlertCircle } from "lucide-react";
import { useDepthEstimation } from "@/hooks/useDepthEstimation";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { useWebcam } from "@/hooks/useWebcam";
import { ProgressBar } from "@/components/ProgressBar";
import {
  DepthVisualizer,
  type ColorScheme,
} from "@/components/depth/DepthVisualizer";
import { DEPTH_MODELS } from "@/lib/depth-constants";

type InputMode = "upload" | "camera";

export default function DepthEstimationPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const depth = useDepthEstimation();
  const webcam = useWebcam({ width: 640, height: 480 });

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("thermal");
  const [isDragging, setIsDragging] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [isCaptured, setIsCaptured] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasDownloadRef = useRef<HTMLCanvasElement | null>(null);

  const selectedModel =
    DEPTH_MODELS.find((m) => m.id === depth.modelId) ?? DEPTH_MODELS[0];

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImageSrc(dataUrl);
        if (depth.isModelReady) {
          depth.estimateDepth(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    },
    [depth]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleCapture = useCallback(() => {
    const canvas = webcam.captureFrame();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    webcam.stop();
    setIsCaptured(true);
    setImageSrc(dataUrl);
    if (depth.isModelReady) {
      depth.estimateDepth(dataUrl);
    }
  }, [webcam, depth]);

  const handleRetake = useCallback(() => {
    setIsCaptured(false);
    setImageSrc(null);
    webcam.start();
  }, [webcam]);

  const handleSwitchMode = useCallback((mode: InputMode) => {
    if (mode === "upload" && webcam.isActive) {
      webcam.stop();
    }
    setInputMode(mode);
    setImageSrc(null);
    setIsCaptured(false);
  }, [webcam]);

  const handleDownload = useCallback(() => {
    if (!depth.depthResult) return;

    // Render to an offscreen canvas and download
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, values } = depth.depthResult;
    canvas.width = width;
    canvas.height = height;

    const colorFn =
      colorScheme === "grayscale"
        ? (v: number) => {
            const c = Math.round(v * 255);
            return [c, c, c];
          }
        : colorScheme === "thermal"
          ? (v: number) => {
              let r: number, g: number, b: number;
              if (v < 0.25) {
                const t = v / 0.25;
                r = 0;
                g = Math.round(t * 255);
                b = 255;
              } else if (v < 0.5) {
                const t = (v - 0.25) / 0.25;
                r = 0;
                g = 255;
                b = Math.round((1 - t) * 255);
              } else if (v < 0.75) {
                const t = (v - 0.5) / 0.25;
                r = Math.round(t * 255);
                g = 255;
                b = 0;
              } else {
                const t = (v - 0.75) / 0.25;
                r = 255;
                g = Math.round((1 - t) * 255);
                b = 0;
              }
              return [r, g, b];
            }
          : (v: number) => {
              const hue = v * 360;
              const c = 1;
              const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
              const m = 0;
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
            };

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < values.length; i++) {
      const [r, g, b] = colorFn(values[i]);
      const offset = i * 4;
      imageData.data[offset] = r;
      imageData.data[offset + 1] = g;
      imageData.data[offset + 2] = b;
      imageData.data[offset + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    const link = document.createElement("a");
    link.download = `depth-map-${colorScheme}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [depth.depthResult, colorScheme]);

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Depth Estimation
            </h1>
            {!isCheckingWebGPU && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: isWebGPUSupported
                    ? "var(--success-bg)"
                    : "var(--error-bg)",
                  color: isWebGPUSupported
                    ? "var(--success)"
                    : "var(--error)",
                  border: `1px solid ${isWebGPUSupported ? "var(--success-border)" : "var(--error-border)"}`,
                }}
              >
                {isWebGPUSupported ? "WebGPU" : "No WebGPU"}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Upload an image or capture from your camera to estimate depth using AI, powered entirely by your
            browser&apos;s GPU.
          </p>
        </div>

        {/* Model Setup */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Model
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {selectedModel.label} &middot; {selectedModel.size}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={depth.modelId}
                onChange={(e) => depth.setModelId(e.target.value)}
                disabled={depth.isModelLoading}
                className="text-xs rounded-lg px-3 py-1.5 outline-none"
                style={{
                  background: "var(--surface)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {DEPTH_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                onClick={depth.loadModel}
                disabled={depth.isModelLoading || depth.isModelReady}
                className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
                style={{
                  background: depth.isModelReady
                    ? "var(--success-bg)"
                    : "var(--accent)",
                  color: depth.isModelReady ? "var(--success)" : "white",
                  border: depth.isModelReady
                    ? "1px solid var(--success-border)"
                    : "none",
                }}
              >
                {depth.isModelLoading
                  ? "Loading..."
                  : depth.isModelReady
                    ? "Ready"
                    : "Load Model"}
              </button>
            </div>
          </div>

          {depth.error && (
            <div
              className="text-xs rounded-lg px-3 py-2 mb-3"
              style={{
                background: "var(--error-bg)",
                color: "var(--error)",
                border: "1px solid var(--error-border)",
              }}
            >
              {depth.error}
            </div>
          )}

          <ProgressBar items={depth.progressItems} />
        </div>

        {/* Image Input */}
        {depth.isModelReady && !imageSrc && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            {/* Input Mode Tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
              <button
                onClick={() => handleSwitchMode("upload")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all"
                style={{
                  background: inputMode === "upload" ? "var(--card)" : "transparent",
                  color: inputMode === "upload" ? "var(--foreground)" : "var(--muted)",
                  boxShadow: inputMode === "upload" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </button>
              <button
                onClick={() => handleSwitchMode("camera")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all"
                style={{
                  background: inputMode === "camera" ? "var(--card)" : "transparent",
                  color: inputMode === "camera" ? "var(--foreground)" : "var(--muted)",
                  boxShadow: inputMode === "camera" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <Video className="w-3.5 h-3.5" />
                Camera
              </button>
            </div>

            {/* Upload Mode */}
            {inputMode === "upload" && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl p-8 text-center cursor-pointer transition-all"
                style={{
                  background: isDragging ? "var(--accent-bg)" : "var(--surface)",
                  border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border-subtle)"}`,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <div
                  className="text-3xl mb-2"
                  style={{ color: "var(--muted-light)" }}
                >
                  {isDragging ? "+" : "\u2191"}
                </div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {isDragging
                    ? "Drop image here"
                    : "Click or drag an image to upload"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Supports JPG, PNG, WebP
                </p>
              </div>
            )}

            {/* Camera Mode */}
            {inputMode === "camera" && (
              <div>
                <div
                  className="relative rounded-xl overflow-hidden mb-3"
                  style={{ border: "1px solid var(--border-subtle)" }}
                >
                  <video
                    ref={webcam.videoRef}
                    className="w-full"
                    style={{ maxHeight: 480, objectFit: "cover" }}
                    playsInline
                    muted
                  />
                  {!webcam.isStreaming && !webcam.error && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center"
                      style={{ background: "var(--surface)" }}
                    >
                      <Camera className="w-8 h-8 mb-3" style={{ color: "var(--muted)" }} />
                      <button
                        onClick={webcam.start}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{ background: "var(--accent)", color: "#fff" }}
                      >
                        Start Camera
                      </button>
                    </div>
                  )}
                </div>
                {webcam.error && (
                  <div
                    className="mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                    style={{ background: "var(--error-bg)", color: "var(--error)" }}
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {webcam.error}
                  </div>
                )}
                {webcam.isStreaming && (
                  <button
                    onClick={handleCapture}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    <Camera className="w-4 h-4" />
                    Capture Photo
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Processing indicator */}
        {depth.isProcessing && (
          <div
            className="rounded-2xl p-5 mb-6 text-center"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div
              className="inline-block w-5 h-5 border-2 rounded-full animate-spin mb-2"
              style={{
                borderColor: "var(--border-subtle)",
                borderTopColor: "var(--accent)",
              }}
            />
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Estimating depth...
            </p>
          </div>
        )}

        {/* Results */}
        {imageSrc && depth.depthResult && !depth.isProcessing && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            {/* Color scheme selector + download + new image */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)" }}
                >
                  Color scheme:
                </span>
                {(["grayscale", "thermal", "rainbow"] as ColorScheme[]).map(
                  (scheme) => (
                    <button
                      key={scheme}
                      onClick={() => setColorScheme(scheme)}
                      className="text-xs px-3 py-1 rounded-lg transition-all capitalize"
                      style={{
                        background:
                          colorScheme === scheme
                            ? "var(--accent)"
                            : "var(--surface)",
                        color:
                          colorScheme === scheme ? "white" : "var(--muted)",
                        border:
                          colorScheme === scheme
                            ? "1px solid var(--accent)"
                            : "1px solid var(--border-subtle)",
                      }}
                    >
                      {scheme}
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                {inputMode === "camera" && isCaptured ? (
                  <button
                    onClick={handleRetake}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity"
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Retake
                  </button>
                ) : (
                  <button
                    onClick={() => setImageSrc(null)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity"
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    New Image
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-opacity"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                  }}
                >
                  Download
                </button>
              </div>
            </div>

            <DepthVisualizer
              originalSrc={imageSrc}
              depthData={depth.depthResult}
              colorScheme={colorScheme}
            />

            <canvas ref={canvasDownloadRef} className="hidden" />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center">
          <div
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: "var(--muted)" }}
          >
            <span>Powered by</span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Transformers.js
            </span>
            <span>&</span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Depth Anything V2
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--muted-light)" }}
          >
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
