"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff } from "lucide-react";

interface WebcamViewProps {
  isActive: boolean;
  onFrame?: (canvas: HTMLCanvasElement) => void;
  frameRate?: number;
  width?: number;
  height?: number;
  onError?: (error: string) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export function WebcamView({
  isActive,
  onFrame,
  frameRate = 30,
  width = 640,
  height = 480,
  onError,
  videoRef: externalVideoRef,
}: WebcamViewProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoElement = externalVideoRef || internalVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: width }, height: { ideal: height }, facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoElement.current) {
        videoElement.current.srcObject = stream;
        await videoElement.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      onError?.(msg);
    }
  }, [width, height, onError, videoElement]);

  const stopStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoElement.current) {
      videoElement.current.srcObject = null;
    }
    setIsStreaming(false);
  }, [videoElement]);

  // Frame capture loop
  useEffect(() => {
    if (!isStreaming || !onFrame) return;

    const canvas = canvasRef.current;
    const video = videoElement.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const interval = 1000 / frameRate;

    const captureFrame = (timestamp: number) => {
      if (timestamp - lastTime >= interval) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        onFrame(canvas);
        lastTime = timestamp;
      }
      animFrameRef.current = requestAnimationFrame(captureFrame);
    };

    animFrameRef.current = requestAnimationFrame(captureFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isStreaming, onFrame, frameRate, videoElement]);

  // Start/stop based on isActive
  useEffect(() => {
    if (isActive) startStream();
    else stopStream();
    return () => stopStream();
  }, [isActive, startStream, stopStream]);

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
      <video
        ref={videoElement}
        className="w-full"
        style={{ display: isStreaming ? "block" : "none" }}
        playsInline
        muted
      />
      {!isStreaming && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          {isActive ? (
            <>
              <Camera className="w-8 h-8 animate-pulse" style={{ color: "var(--muted)" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>Starting camera...</p>
            </>
          ) : (
            <>
              <CameraOff className="w-8 h-8" style={{ color: "var(--muted-light)" }} />
              <p className="text-sm" style={{ color: "var(--muted-light)" }}>Camera off</p>
            </>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
