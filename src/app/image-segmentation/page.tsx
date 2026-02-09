"use client";

import { useState, useRef, useCallback } from "react";
import { useSegmentation } from "@/hooks/useSegmentation";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { useWebcam } from "@/hooks/useWebcam";
import { ProgressBar } from "@/components/ProgressBar";
import { SegmentCanvas } from "@/components/segmentation/SegmentCanvas";
import { SEGMENTATION_MODELS } from "@/lib/segmentation-constants";
import type { ClickPoint } from "@/hooks/useSegmentation";
import {
  Scissors,
  Upload,
  Trash2,
  Download,
  Loader2,
  AlertCircle,
  Camera,
  Video,
  RotateCcw,
  ChevronDown,
  MousePointer,
  Ban,
} from "lucide-react";

type InputMode = "upload" | "camera";

export default function ImageSegmentationPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();
  const seg = useSegmentation();
  const webcam = useWebcam({ width: 640, height: 480 });
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 640, height: 480 });
  const [clickPoints, setClickPoints] = useState<ClickPoint[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [isCaptured, setIsCaptured] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel =
    SEGMENTATION_MODELS.find((m) => m.id === seg.modelId) ?? SEGMENTATION_MODELS[0];

  // Get the currently selected mask (single mask for canvas)
  const activeMask = seg.masks.length > 0 ? seg.masks[seg.selectedMaskIndex] ?? null : null;
  const activeScore = seg.scores.length > 0 ? seg.scores[seg.selectedMaskIndex] : undefined;

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = e.target.value;
    seg.setModelId(newModelId);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageFromDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const setImageFromDataUrl = (dataUrl: string) => {
    setImageSrc(dataUrl);
    setClickPoints([]);

    const img = new Image();
    img.onload = () => {
      const maxW = 640;
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
      setImageSize({
        width: Math.round(img.naturalWidth * scale),
        height: Math.round(img.naturalHeight * scale),
      });
    };
    img.src = dataUrl;
  };

  const handleCapture = () => {
    const canvas = webcam.captureFrame();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    webcam.stop();
    setIsCaptured(true);
    setImageFromDataUrl(dataUrl);
  };

  const handleRetake = () => {
    setIsCaptured(false);
    setImageSrc(null);
    setClickPoints([]);
    webcam.start();
  };

  const handleImageClick = useCallback(
    (point: ClickPoint) => {
      if (!imageSrc || seg.isSegmenting) return;
      const newPoints = [...clickPoints, point];
      setClickPoints(newPoints);
      seg.segment(imageSrc, newPoints);
    },
    [imageSrc, clickPoints, seg]
  );

  const handleClearPoints = () => {
    setClickPoints([]);
  };

  const handleDownload = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "segmented-image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleSwitchMode = (mode: InputMode) => {
    if (mode === "upload" && webcam.isActive) {
      webcam.stop();
    }
    setInputMode(mode);
    setImageSrc(null);
    setClickPoints([]);
    setIsCaptured(false);
  };

  // Mask granularity labels for the selector
  const maskLabels = ["Precise", "Balanced", "Broad"];

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}
            >
              <Scissors className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Image Segmentation
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Upload an image or capture from your camera, then click on objects to segment them.
            Uses Meta&apos;s Segment Anything running entirely in your browser via WebGPU.
          </p>
          {!isCheckingWebGPU && !isWebGPUSupported && (
            <div
              className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--warning-border)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              WebGPU not available. Inference may be slower.
            </div>
          )}
        </div>

        {/* Model Setup */}
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 mr-4">
              <div className="relative">
                <select
                  value={seg.modelId}
                  onChange={handleModelChange}
                  disabled={seg.isModelLoading || seg.isModelReady}
                  className="w-full appearance-none text-sm font-semibold bg-transparent pr-7 py-1 cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ color: "var(--foreground)" }}
                >
                  {SEGMENTATION_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "var(--muted)" }}
                />
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {selectedModel.description} ({selectedModel.size})
              </p>
            </div>
            <button
              onClick={seg.loadModel}
              disabled={seg.isModelLoading || seg.isModelReady}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0"
              style={{
                background: seg.isModelReady ? "var(--success-bg)" : "var(--accent)",
                color: seg.isModelReady ? "var(--success)" : "#fff",
                opacity: seg.isModelLoading ? 0.7 : 1,
                border: seg.isModelReady ? "1px solid var(--success-border)" : "none",
              }}
            >
              {seg.isModelLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading...
                </span>
              ) : seg.isModelReady ? (
                "Ready"
              ) : (
                "Load Model"
              )}
            </button>
          </div>
          <ProgressBar items={seg.progressItems} />
          {seg.error && (
            <div
              className="mt-3 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--error-bg)", color: "var(--error)" }}
            >
              {seg.error}
            </div>
          )}
        </div>

        {/* Image Input + Canvas */}
        {seg.isModelReady && (
          <div className="card p-5 mb-6">
            {/* Input Mode Tabs */}
            {!imageSrc && (
              <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
                <button
                  onClick={() => handleSwitchMode("upload")}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: inputMode === "upload" ? "var(--card-bg)" : "transparent",
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
                    background: inputMode === "camera" ? "var(--card-bg)" : "transparent",
                    color: inputMode === "camera" ? "var(--foreground)" : "var(--muted)",
                    boxShadow: inputMode === "camera" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  <Video className="w-3.5 h-3.5" />
                  Camera
                </button>
              </div>
            )}

            {/* Upload Mode */}
            {inputMode === "upload" && !imageSrc && (
              <div
                className="flex flex-col items-center justify-center py-12 rounded-xl cursor-pointer transition-all hover:opacity-80"
                style={{
                  background: "var(--surface)",
                  border: "2px dashed var(--border-subtle)",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mb-3" style={{ color: "var(--muted)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Click to upload an image
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  JPG, PNG, or WebP
                </p>
              </div>
            )}

            {/* Camera Mode - Live Feed */}
            {inputMode === "camera" && !imageSrc && (
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

            {/* Segmentation Canvas (after image is loaded from either source) */}
            {imageSrc && (
              <div>
                {/* Instructions + actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                    <span className="flex items-center gap-1">
                      <MousePointer className="w-3 h-3" />
                      Click to include
                    </span>
                    <span className="flex items-center gap-1">
                      <Ban className="w-3 h-3" />
                      Right-click to exclude
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {clickPoints.length > 0 && (
                      <button
                        onClick={handleClearPoints}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: "var(--surface)",
                          color: "var(--muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                    {seg.masks.length > 0 && (
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: "var(--accent)",
                          color: "#fff",
                        }}
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <SegmentCanvas
                    imageSrc={imageSrc}
                    mask={activeMask}
                    points={clickPoints}
                    onImageClick={handleImageClick}
                    width={imageSize.width}
                    height={imageSize.height}
                    score={activeScore}
                  />
                  {seg.isSegmenting && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* Mask granularity selector — only show when we have multiple masks */}
                {seg.masks.length > 1 && (
                  <div className="mt-3">
                    <p className="text-xs mb-2 font-medium" style={{ color: "var(--muted)" }}>
                      Mask granularity
                    </p>
                    <div className="flex gap-1.5">
                      {seg.masks.map((_, i) => {
                        const label = maskLabels[i] || `Mask ${i + 1}`;
                        const score = seg.scores[i];
                        const isActive = seg.selectedMaskIndex === i;
                        return (
                          <button
                            key={i}
                            onClick={() => seg.setSelectedMaskIndex(i)}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: isActive ? "var(--accent)" : "var(--surface)",
                              color: isActive ? "#fff" : "var(--muted)",
                              border: isActive ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                            }}
                          >
                            <span className="block">{label}</span>
                            {score !== undefined && (
                              <span className="block text-[10px] mt-0.5" style={{ opacity: 0.8 }}>
                                {(score * 100).toFixed(0)}%
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3">
                  {inputMode === "camera" && isCaptured ? (
                    <button
                      onClick={handleRetake}
                      className="flex items-center gap-1.5 text-xs underline"
                      style={{ color: "var(--muted)" }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retake photo
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setImageSrc(null);
                        setClickPoints([]);
                      }}
                      className="text-xs underline"
                      style={{ color: "var(--muted)" }}
                    >
                      Upload a different image
                    </button>
                  )}
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
            <span>Powered by</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Transformers.js</span>
            <span>&</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>
              {selectedModel.modelClass === "sam3" ? "SAM3" : "Segment Anything"}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
