"use client";

import { useState, useRef, useCallback } from "react";
import { ImagePlus, RefreshCw, Upload, Video, Camera, AlertCircle } from "lucide-react";
import { useWebcam } from "@/hooks/useWebcam";

type InputMode = "upload" | "camera";

interface ImageUploadZoneProps {
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
}

export function ImageUploadZone({ imageUrl, onImageChange }: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcam = useWebcam({ width: 640, height: 480 });

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          onImageChange(result);
        }
      };
      reader.readAsDataURL(file);
    },
    [onImageChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleChangeImage = useCallback(() => {
    onImageChange(null);
    if (webcam.isActive) {
      webcam.stop();
    }
    fileInputRef.current?.click();
  }, [onImageChange, webcam]);

  const handleCapture = useCallback(() => {
    const canvas = webcam.captureFrame();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    webcam.stop();
    onImageChange(dataUrl);
  }, [webcam, onImageChange]);

  const handleSwitchMode = useCallback((mode: InputMode) => {
    if (mode === "upload" && webcam.isActive) {
      webcam.stop();
    }
    setInputMode(mode);
  }, [webcam]);

  if (imageUrl) {
    return (
      <div className="relative group">
        <div
          className="rounded-xl overflow-hidden"
          style={{
            border: "1px solid var(--card-border)",
            background: "var(--surface)",
          }}
        >
          <img
            src={imageUrl}
            alt="Uploaded image"
            className="w-full max-h-64 object-contain"
            style={{ background: "var(--surface)" }}
          />
        </div>
        <button
          onClick={handleChangeImage}
          className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:brightness-95 active:scale-95"
          style={{
            background: "var(--card)",
            color: "var(--muted)",
            border: "1px solid var(--card-border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <RefreshCw className="w-3 h-3" />
          Change image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div>
      {/* Input Mode Tabs */}
      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
        <button
          onClick={() => handleSwitchMode("upload")}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
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
          className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className="rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
          style={{
            border: isDragging
              ? "2px dashed var(--accent)"
              : "2px dashed var(--border-subtle)",
            background: isDragging ? "var(--accent-bg)" : "var(--surface)",
            minHeight: "160px",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: isDragging ? "var(--accent)" : "var(--card)",
              border: isDragging ? "none" : "1px solid var(--card-border)",
            }}
          >
            <ImagePlus
              className="w-6 h-6"
              style={{ color: isDragging ? "#FFFFFF" : "var(--muted)" }}
            />
          </div>
          <div className="text-center">
            <p
              className="text-sm font-medium"
              style={{ color: isDragging ? "var(--accent)" : "var(--foreground)" }}
            >
              {isDragging ? "Drop image here" : "Upload an image"}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
              Drag and drop or click to browse
            </p>
          </div>
        </div>
      )}

      {/* Camera Mode */}
      {inputMode === "camera" && (
        <div>
          <div
            className="relative rounded-xl overflow-hidden mb-3"
            style={{ border: "1px solid var(--border-subtle)", minHeight: "160px" }}
          >
            <video
              ref={webcam.videoRef}
              className="w-full"
              style={{ maxHeight: 320, objectFit: "cover" }}
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
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
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
