"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ScanSearch,
  Upload,
  Video,
  VideoOff,
  Download,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Settings,
  Image as ImageIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { useObjectDetection } from "@/hooks/useObjectDetection";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { DETECTION_MODELS } from "@/lib/detection-constants";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { DetectionCanvas } from "@/components/detection/DetectionCanvas";
import { ConfidenceSlider } from "@/components/detection/ConfidenceSlider";

type InputMode = "image" | "webcam";

export default function ObjectDetectionPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();
  const detection = useObjectDetection();
  const selectedModel =
    DETECTION_MODELS.find((m) => m.id === detection.modelId) ??
    DETECTION_MODELS[0];

  // UI state
  const [inputMode, setInputMode] = useState<InputMode>("image");
  const [threshold, setThreshold] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Webcam state
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [fps, setFps] = useState(0);
  const [inferenceTime, setInferenceTime] = useState(0);
  const lastTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(0);
  const isDetectingRef = useRef(false);

  // Displayed dimensions (the rendered size of the image/video)
  const [displayWidth, setDisplayWidth] = useState(0);
  const [displayHeight, setDisplayHeight] = useState(0);

  // Refs for values the RAF loop reads (avoids stale closures + effect thrashing)
  const thresholdRef = useRef(threshold);
  const detectFnRef = useRef(detection.detect);
  thresholdRef.current = threshold;
  detectFnRef.current = detection.detect;

  // Handle image file selection
  const handleImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      detection.detections.length > 0 &&
        detection.detect("", 0); // clear previous — will be re-detected below

      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = url;
    },
    [detection]
  );

  // Run detection on image when it loads
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !detection.isModelReady) return;
    const img = imageRef.current;
    setDisplayWidth(img.clientWidth);
    setDisplayHeight(img.clientHeight);
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });

    // Convert to base64 data URL for the worker
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      detection.detect(dataUrl, threshold);
    }
  }, [detection, threshold]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageFile(file);
    },
    [handleImageFile]
  );

  // Re-detect when threshold changes (image mode)
  const handleThresholdChange = useCallback(
    (newThreshold: number) => {
      setThreshold(newThreshold);
      if (inputMode === "image" && imageRef.current && detection.isModelReady) {
        const img = imageRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          detection.detect(dataUrl, newThreshold);
        }
      }
    },
    [inputMode, detection]
  );

  // Webcam start/stop
  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsWebcamActive(true);
      }
    } catch (err) {
      console.error("Webcam access error:", err);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
    setFps(0);
    setInferenceTime(0);
    isDetectingRef.current = false;
  }, []);

  // Webcam detection loop — reads threshold/detect from refs
  // so the RAF loop doesn't restart on every keystroke or render.
  useEffect(() => {
    if (!isWebcamActive || !detection.isModelReady || inputMode !== "webcam")
      return;

    const video = videoRef.current;
    const offscreen = webcamCanvasRef.current;
    if (!video || !offscreen) return;

    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const detectFrame = () => {
      if (!isWebcamActive || !video.videoWidth) {
        rafRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      // Update display dimensions
      setDisplayWidth(video.clientWidth);
      setDisplayHeight(video.clientHeight);
      setImageDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });

      if (!isDetectingRef.current) {
        isDetectingRef.current = true;
        offscreen.width = video.videoWidth;
        offscreen.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const dataUrl = offscreen.toDataURL("image/jpeg", 0.7);
        lastTimeRef.current = performance.now();
        detectFnRef.current(
          dataUrl,
          thresholdRef.current,
        );
      }

      rafRef.current = requestAnimationFrame(detectFrame);
    };

    rafRef.current = requestAnimationFrame(detectFrame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isWebcamActive, detection.isModelReady, inputMode]);

  // When detections arrive in webcam mode, compute FPS and allow next frame
  useEffect(() => {
    if (inputMode !== "webcam" || !isWebcamActive) return;

    if (lastTimeRef.current > 0) {
      const elapsed = performance.now() - lastTimeRef.current;
      setInferenceTime(Math.round(elapsed));

      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsUpdateRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
    }

    isDetectingRef.current = false;
  }, [detection.detections, inputMode, isWebcamActive]);

  // Cleanup webcam on unmount or mode switch
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Handle window resize for image display dimensions
  useEffect(() => {
    const updateDisplaySize = () => {
      if (inputMode === "image" && imageRef.current) {
        setDisplayWidth(imageRef.current.clientWidth);
        setDisplayHeight(imageRef.current.clientHeight);
      } else if (inputMode === "webcam" && videoRef.current) {
        setDisplayWidth(videoRef.current.clientWidth);
        setDisplayHeight(videoRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", updateDisplaySize);
    return () => window.removeEventListener("resize", updateDisplaySize);
  }, [inputMode]);

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <ScanSearch
                className="w-5 h-5"
                style={{ color: "var(--accent)" }}
              />
            </div>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                Object Detection
              </h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Detect and locate objects in images and video
              </p>
            </div>
          </div>

          {/* WebGPU Badge */}
          {!isCheckingWebGPU && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: isWebGPUSupported
                  ? "var(--success-bg)"
                  : "var(--error-bg)",
                color: isWebGPUSupported
                  ? "var(--success)"
                  : "var(--error)",
                border: `1px solid ${
                  isWebGPUSupported
                    ? "var(--success-border)"
                    : "var(--error-border)"
                }`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: isWebGPUSupported
                    ? "var(--success)"
                    : "var(--error)",
                }}
              />
              {isWebGPUSupported
                ? "WebGPU Available"
                : "WebGPU Not Available"}
            </div>
          )}
        </div>

        {/* Model Setup */}
        <div
          className="card p-6 mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Settings
                className="w-[18px] h-[18px]"
                style={{ color: "var(--muted)" }}
              />
              <h2
                className="text-base font-semibold"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                Model Setup
              </h2>
            </div>
            <StatusIndicator
              status={
                detection.isModelReady
                  ? "ready"
                  : detection.isModelLoading
                  ? "loading"
                  : detection.error
                  ? "error"
                  : "idle"
              }
            />
          </div>

          {!detection.isModelReady && (
            <>
              {/* Model Selector */}
              <div className="mb-5">
                <label
                  className="text-xs font-medium mb-2 block"
                  style={{ color: "var(--muted)" }}
                >
                  Model
                </label>
                <div className="relative">
                  <select
                    value={detection.modelId}
                    onChange={(e) => detection.setModelId(e.target.value)}
                    disabled={detection.isModelLoading}
                    className={clsx(
                      "w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-medium transition-all focus:outline-none",
                      detection.isModelLoading &&
                        "opacity-40 cursor-not-allowed"
                    )}
                    style={{
                      background: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {DETECTION_MODELS.map((model) => (
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
                <p
                  className="text-xs mt-1.5"
                  style={{ color: "var(--muted-light)" }}
                >
                  {selectedModel.description}
                </p>
              </div>

              {/* Load Button */}
              <button
                onClick={detection.loadModel}
                disabled={detection.isModelLoading}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  detection.isModelLoading
                    ? "cursor-wait"
                    : "hover:brightness-110 active:scale-[0.99]"
                )}
                style={{
                  background: detection.isModelLoading
                    ? "var(--accent-bg)"
                    : "var(--accent)",
                  color: detection.isModelLoading
                    ? "var(--accent)"
                    : "#FFFFFF",
                  border: detection.isModelLoading
                    ? "1px solid var(--accent-border)"
                    : "none",
                  boxShadow: detection.isModelLoading
                    ? "none"
                    : "0 2px 12px rgba(194, 114, 78, 0.3)",
                }}
              >
                {detection.isModelLoading ? (
                  <>
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: "var(--accent-border)",
                        borderTopColor: "var(--accent)",
                      }}
                    />
                    Loading Model...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Load Detection Model
                  </>
                )}
              </button>

              <ProgressBar items={detection.progressItems} />

              {detection.error && (
                <div
                  className="mt-4 flex items-start gap-2 p-3 rounded-xl"
                  style={{
                    background: "var(--error-bg)",
                    border: "1px solid var(--error-border)",
                  }}
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: "var(--error)" }}
                  />
                  <p className="text-sm" style={{ color: "var(--error)" }}>
                    {detection.error}
                  </p>
                </div>
              )}
            </>
          )}

          {detection.isModelReady && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
              }}
            >
              <CheckCircle2
                className="w-5 h-5"
                style={{ color: "var(--success)" }}
              />
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--success)" }}
                >
                  Model Ready
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--success)", opacity: 0.7 }}
                >
                  {selectedModel.label} loaded on WebGPU
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Detection Area */}
        {detection.isModelReady && (
          <div
            className="card p-6 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            {/* Mode Toggle */}
            <div className="flex items-center gap-2 mb-5">
              <button
                onClick={() => {
                  if (isWebcamActive) stopWebcam();
                  setInputMode("image");
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background:
                    inputMode === "image"
                      ? "var(--accent-bg)"
                      : "var(--surface)",
                  color:
                    inputMode === "image" ? "var(--accent)" : "var(--muted)",
                  border: `1px solid ${
                    inputMode === "image"
                      ? "var(--accent-border)"
                      : "var(--border-subtle)"
                  }`,
                }}
              >
                <ImageIcon className="w-4 h-4" />
                Image
              </button>
              <button
                onClick={() => {
                  setInputMode("webcam");
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background:
                    inputMode === "webcam"
                      ? "var(--accent-bg)"
                      : "var(--surface)",
                  color:
                    inputMode === "webcam" ? "var(--accent)" : "var(--muted)",
                  border: `1px solid ${
                    inputMode === "webcam"
                      ? "var(--accent-border)"
                      : "var(--border-subtle)"
                  }`,
                }}
              >
                <Video className="w-4 h-4" />
                Webcam
              </button>
            </div>

            {/* Confidence Slider */}
            <div className="mb-5">
              <ConfidenceSlider
                value={threshold}
                onChange={handleThresholdChange}
              />
            </div>

            {/* Image Mode */}
            {inputMode === "image" && (
              <div>
                {!imageUrl && (
                  <div
                    className={clsx(
                      "rounded-xl p-10 text-center cursor-pointer transition-all",
                      isDragging && "scale-[1.01]"
                    )}
                    style={{
                      background: isDragging
                        ? "var(--accent-bg)"
                        : "var(--surface)",
                      border: `2px dashed ${
                        isDragging
                          ? "var(--accent)"
                          : "var(--border-subtle)"
                      }`,
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload
                      className="w-8 h-8 mx-auto mb-3"
                      style={{ color: "var(--muted-light)" }}
                    />
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: "var(--foreground)" }}
                    >
                      Drop an image here or click to upload
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-light)" }}
                    >
                      Supports JPEG, PNG, WebP
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFile(file);
                      }}
                    />
                  </div>
                )}

                {imageUrl && (
                  <div>
                    <div
                      ref={imageContainerRef}
                      className="relative rounded-xl overflow-hidden"
                      style={{
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={imageRef}
                        src={imageUrl}
                        alt="Detection target"
                        className="w-full h-auto block"
                        onLoad={handleImageLoad}
                      />
                      {displayWidth > 0 && displayHeight > 0 && (
                        <DetectionCanvas
                          detections={detection.detections}
                          imageWidth={imageDimensions.width}
                          imageHeight={imageDimensions.height}
                          canvasWidth={displayWidth}
                          canvasHeight={displayHeight}
                        />
                      )}
                      {detection.isDetecting && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                          <div
                            className="w-6 h-6 border-2 rounded-full animate-spin"
                            style={{
                              borderColor: "var(--accent-border)",
                              borderTopColor: "var(--accent)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={() => {
                          setImageUrl(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: "var(--surface)",
                          color: "var(--muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        New Image
                      </button>
                      {detection.detections.length > 0 && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          {detection.detections.length} object
                          {detection.detections.length !== 1 ? "s" : ""}{" "}
                          detected
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Webcam Mode */}
            {inputMode === "webcam" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={isWebcamActive ? stopWebcam : startWebcam}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: isWebcamActive
                        ? "var(--error)"
                        : "var(--accent)",
                      color: "#FFFFFF",
                      boxShadow: isWebcamActive
                        ? "0 2px 12px rgba(194, 84, 84, 0.3)"
                        : "0 2px 12px rgba(194, 114, 78, 0.3)",
                    }}
                  >
                    {isWebcamActive ? (
                      <>
                        <VideoOff className="w-4 h-4" />
                        Stop Webcam
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        Start Webcam
                      </>
                    )}
                  </button>
                  {isWebcamActive && (
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg"
                        style={{
                          background: "var(--surface)",
                          color: "var(--foreground)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {fps} FPS
                      </span>
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--muted)" }}
                      >
                        {inferenceTime}ms
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    border: "1px solid var(--border-subtle)",
                    background: "var(--surface)",
                    minHeight: isWebcamActive ? "auto" : "300px",
                  }}
                >
                  <video
                    ref={videoRef}
                    className="w-full h-auto block"
                    playsInline
                    muted
                    style={{
                      display: isWebcamActive ? "block" : "none",
                    }}
                  />
                  <canvas
                    ref={webcamCanvasRef}
                    className="hidden"
                  />
                  {isWebcamActive &&
                    displayWidth > 0 &&
                    displayHeight > 0 && (
                      <DetectionCanvas
                        detections={detection.detections}
                        imageWidth={imageDimensions.width}
                        imageHeight={imageDimensions.height}
                        canvasWidth={displayWidth}
                        canvasHeight={displayHeight}
                      />
                    )}
                  {!isWebcamActive && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Video
                        className="w-10 h-10 mb-3"
                        style={{ color: "var(--muted-light)" }}
                      />
                      <p
                        className="text-sm"
                        style={{ color: "var(--muted)" }}
                      >
                        Click &quot;Start Webcam&quot; to begin real-time
                        detection
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Detections List */}
            {detection.detections.length > 0 && (
              <div className="mt-5">
                <h3
                  className="text-xs font-medium mb-2"
                  style={{ color: "var(--muted)" }}
                >
                  Detected Objects
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detection.detections.map((det, i) => (
                    <div
                      key={`${det.label}-${i}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: "var(--surface)",
                        color: "var(--foreground)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span>{det.label}</span>
                      <span
                        className="font-mono"
                        style={{ color: "var(--muted)" }}
                      >
                        {(det.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              {selectedModel.label}
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
