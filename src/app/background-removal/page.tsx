"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ImageMinus, Upload, Settings, Download, ChevronDown, AlertCircle, CheckCircle2, X, Camera, Video, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import { useBackgroundRemoval } from "@/hooks/useBackgroundRemoval";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { useWebcam } from "@/hooks/useWebcam";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { ResultView } from "@/components/bg-removal/ResultView";
import { BG_REMOVAL_MODELS } from "@/lib/bg-removal-constants";

type InputMode = "upload" | "camera";

export default function BackgroundRemovalPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const bgRemoval = useBackgroundRemoval();
  const webcam = useWebcam({ width: 640, height: 480 });

  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [isCaptured, setIsCaptured] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-load when WebGPU isn't available — warn user
  useEffect(() => {
    if (!isCheckingWebGPU && !isWebGPUSupported) {
      // WebGPU required for this feature
    }
  }, [isCheckingWebGPU, isWebGPUSupported]);

  const selectedModel =
    BG_REMOVAL_MODELS.find((m) => m.id === bgRemoval.modelId) ??
    BG_REMOVAL_MODELS[0];

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setOriginalImageUrl(dataUrl);
        bgRemoval.reset();
        if (bgRemoval.isModelReady) {
          bgRemoval.processImage(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    },
    [bgRemoval]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
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
    setOriginalImageUrl(dataUrl);
    bgRemoval.reset();
    if (bgRemoval.isModelReady) {
      bgRemoval.processImage(dataUrl);
    }
  }, [webcam, bgRemoval]);

  const handleRetake = useCallback(() => {
    setIsCaptured(false);
    setOriginalImageUrl(null);
    bgRemoval.reset();
    webcam.start();
  }, [bgRemoval, webcam]);

  const handleSwitchMode = useCallback((mode: InputMode) => {
    if (mode === "upload" && webcam.isActive) {
      webcam.stop();
    }
    setInputMode(mode);
    setOriginalImageUrl(null);
    setIsCaptured(false);
    bgRemoval.reset();
  }, [webcam, bgRemoval]);

  const handleProcessClick = useCallback(() => {
    if (originalImageUrl) {
      bgRemoval.processImage(originalImageUrl);
    }
  }, [bgRemoval, originalImageUrl]);

  const handleDownload = useCallback(() => {
    if (!bgRemoval.result) return;
    const link = document.createElement("a");
    link.href = bgRemoval.result.imageUrl;
    link.download = "background-removed.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [bgRemoval.result]);

  const handleClearImage = useCallback(() => {
    setOriginalImageUrl(null);
    setIsCaptured(false);
    bgRemoval.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [bgRemoval]);

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <header className="text-center mb-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="p-2.5 rounded-xl animate-float"
              style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}
            >
              <ImageMinus className="w-7 h-7" style={{ color: "var(--accent)" }} />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Background Removal
            </h1>
          </div>
          <p className="text-sm mb-4 max-w-md mx-auto leading-relaxed" style={{ color: "var(--muted)" }}>
            Remove image backgrounds with AI — running entirely in your browser
          </p>
          <div className="flex items-center justify-center gap-2">
            {isCheckingWebGPU ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "var(--surface)", color: "var(--muted)", border: "1px solid var(--border-subtle)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--muted-light)" }} />
                Checking WebGPU...
              </span>
            ) : isWebGPUSupported ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
                WebGPU Available
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error-border)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--error)" }} />
                WebGPU Required
              </span>
            )}
          </div>
        </header>

        {/* Model Setup */}
        <div className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Settings className="w-[18px] h-[18px]" style={{ color: "var(--muted)" }} />
              <h2
                className="text-base font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >
                Model Setup
              </h2>
            </div>
            <StatusIndicator
              status={bgRemoval.isModelReady ? "ready" : bgRemoval.isModelLoading ? "loading" : bgRemoval.error ? "error" : "idle"}
            />
          </div>

          {!bgRemoval.isModelReady && (
            <>
              {/* Model Selector */}
              <div className="mb-5">
                <label className="text-xs font-medium mb-2 block" style={{ color: "var(--muted)" }}>
                  Model
                </label>
                <div className="relative">
                  <select
                    value={bgRemoval.modelId}
                    onChange={(e) => bgRemoval.setModelId(e.target.value)}
                    disabled={bgRemoval.isModelLoading}
                    className={clsx(
                      "w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-medium transition-all focus:outline-none",
                      bgRemoval.isModelLoading && "opacity-40 cursor-not-allowed"
                    )}
                    style={{
                      background: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {BG_REMOVAL_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label} — {model.size}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "var(--muted-light)" }}
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--muted-light)" }}>
                  {selectedModel.description}
                </p>
              </div>

              {/* Load Button */}
              <button
                onClick={bgRemoval.loadModel}
                disabled={bgRemoval.isModelLoading || (!isCheckingWebGPU && !isWebGPUSupported)}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  bgRemoval.isModelLoading || (!isCheckingWebGPU && !isWebGPUSupported)
                    ? "cursor-not-allowed"
                    : "hover:brightness-110 active:scale-[0.99]"
                )}
                style={{
                  background:
                    !isCheckingWebGPU && !isWebGPUSupported
                      ? "var(--muted-light)"
                      : bgRemoval.isModelLoading
                      ? "var(--accent-bg)"
                      : "var(--accent)",
                  color:
                    !isCheckingWebGPU && !isWebGPUSupported
                      ? "var(--card)"
                      : bgRemoval.isModelLoading
                      ? "var(--accent)"
                      : "#FFFFFF",
                  border: bgRemoval.isModelLoading ? "1px solid var(--accent-border)" : "none",
                  boxShadow: bgRemoval.isModelLoading || (!isCheckingWebGPU && !isWebGPUSupported) ? "none" : "0 2px 12px rgba(194, 114, 78, 0.3)",
                }}
              >
                {bgRemoval.isModelLoading ? (
                  <>
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: "var(--accent-border)", borderTopColor: "var(--accent)" }}
                    />
                    Loading Model...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Load Model
                  </>
                )}
              </button>

              {!isCheckingWebGPU && !isWebGPUSupported && (
                <p className="text-xs mt-2 text-center" style={{ color: "var(--error)" }}>
                  WebGPU is required for background removal. Try Chrome or Edge.
                </p>
              )}

              {/* Progress */}
              <ProgressBar items={bgRemoval.progressItems} />

              {/* Error */}
              {bgRemoval.error && (
                <div
                  className="mt-4 flex items-start gap-2 p-3 rounded-xl"
                  style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)" }}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--error)" }} />
                  <p className="text-sm" style={{ color: "var(--error)" }}>{bgRemoval.error}</p>
                </div>
              )}
            </>
          )}

          {bgRemoval.isModelReady && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)" }}
            >
              <CheckCircle2 className="w-5 h-5" style={{ color: "var(--success)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--success)" }}>Model Ready</p>
                <p className="text-xs" style={{ color: "var(--success)", opacity: 0.7 }}>
                  {selectedModel.label} loaded on WebGPU
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Image Upload / Processing Area */}
        {bgRemoval.isModelReady && (
          <div className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            {!originalImageUrl && !bgRemoval.result && (
              <>
                {/* Input Mode Tabs */}
                <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
                  <button
                    onClick={() => handleSwitchMode("upload")}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: inputMode === "upload" ? "var(--card-bg, var(--card))" : "transparent",
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
                      background: inputMode === "camera" ? "var(--card-bg, var(--card))" : "transparent",
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
                    className={clsx(
                      "relative rounded-xl p-10 text-center transition-all cursor-pointer",
                      isDragOver && "scale-[1.01]"
                    )}
                    style={{
                      background: isDragOver ? "var(--accent-bg)" : "var(--surface)",
                      border: `2px dashed ${isDragOver ? "var(--accent)" : "var(--border-subtle)"}`,
                    }}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload
                      className="w-10 h-10 mx-auto mb-3"
                      style={{ color: isDragOver ? "var(--accent)" : "var(--muted-light)" }}
                    />
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                      Drop an image here or click to upload
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                      Supports PNG, JPG, and WebP
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

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </>
            )}

            {/* Processing state */}
            {originalImageUrl && bgRemoval.isProcessing && (
              <div className="text-center py-8">
                <div className="relative inline-block mb-4">
                  <img
                    src={originalImageUrl}
                    alt="Processing"
                    className="max-h-64 rounded-xl mx-auto opacity-50"
                    style={{ border: "1px solid var(--card-border)" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-10 h-10 border-3 rounded-full animate-spin"
                        style={{ borderColor: "var(--accent-border)", borderTopColor: "var(--accent)" }}
                      />
                      <span className="text-sm font-medium px-3 py-1 rounded-lg" style={{
                        background: "rgba(255,255,255,0.9)",
                        color: "var(--accent)",
                      }}>
                        Removing background...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Result view */}
            {originalImageUrl && bgRemoval.result && !bgRemoval.isProcessing && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3
                    className="text-sm font-semibold"
                    style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
                  >
                    Result
                  </h3>
                  <div className="flex items-center gap-2">
                    {inputMode === "camera" && isCaptured ? (
                      <button
                        onClick={handleRetake}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-95"
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
                        onClick={handleClearImage}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-95"
                        style={{
                          background: "var(--surface)",
                          color: "var(--muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <X className="w-3 h-3" />
                        New Image
                      </button>
                    )}
                  </div>
                </div>
                <ResultView
                  originalSrc={originalImageUrl}
                  resultSrc={bgRemoval.result.imageUrl}
                  onDownload={handleDownload}
                />
              </div>
            )}

            {/* Image loaded but not yet processed (shouldn't normally happen since we auto-process) */}
            {originalImageUrl && !bgRemoval.result && !bgRemoval.isProcessing && !bgRemoval.error && (
              <div className="text-center py-6">
                <img
                  src={originalImageUrl}
                  alt="Uploaded"
                  className="max-h-64 rounded-xl mx-auto mb-4"
                  style={{ border: "1px solid var(--card-border)" }}
                />
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleProcessClick}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99]"
                    style={{
                      background: "var(--accent)",
                      color: "#FFFFFF",
                      boxShadow: "0 2px 12px rgba(194, 114, 78, 0.3)",
                    }}
                  >
                    <ImageMinus className="w-4 h-4" />
                    Remove Background
                  </button>
                  <button
                    onClick={handleClearImage}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-95"
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Error during processing */}
            {bgRemoval.error && originalImageUrl && (
              <div className="mt-4">
                <div
                  className="flex items-start gap-2 p-3 rounded-xl mb-3"
                  style={{ background: "var(--error-bg)", border: "1px solid var(--error-border)" }}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--error)" }} />
                  <p className="text-sm" style={{ color: "var(--error)" }}>{bgRemoval.error}</p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleProcessClick}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:brightness-110"
                    style={{
                      background: "var(--accent)",
                      color: "#FFFFFF",
                    }}
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleClearImage}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:brightness-95"
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
            <span>Powered by</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Transformers.js</span>
            <span>&</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>RMBG</span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
