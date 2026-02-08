"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DEFAULT_BG_REMOVAL_MODEL_ID } from "@/lib/bg-removal-constants";

interface ProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

interface ModelLoadProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  name?: string;
}

interface BgRemovalResult {
  imageUrl: string;
  width: number;
  height: number;
}

interface BgRemovalState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isProcessing: boolean;
  progressItems: ProgressItem[];
  result: BgRemovalResult | null;
  error: string | null;
  modelId: string;
  setModelId: (modelId: string) => void;
  loadModel: () => void;
  processImage: (imageDataUrl: string) => void;
  reset: () => void;
}

export function useBackgroundRemoval(): BgRemovalState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [result, setResult] = useState<BgRemovalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_BG_REMOVAL_MODEL_ID);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../app/background-removal/bg-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "initiate": {
          const data = message.data as ModelLoadProgress;
          setProgressItems((prev) => {
            const existing = prev.find((p) => p.file === data.file);
            if (existing) return prev;
            return [
              ...prev,
              {
                file: data.file || "unknown",
                progress: 0,
                loaded: 0,
                total: 0,
                name: data.name,
                status: "initiate",
              },
            ];
          });
          break;
        }
        case "progress": {
          const data = message.data as ModelLoadProgress;
          setProgressItems((prev) =>
            prev.map((item) =>
              item.file === data.file
                ? {
                    ...item,
                    progress: data.progress ?? item.progress,
                    loaded: data.loaded ?? item.loaded,
                    total: data.total ?? item.total,
                    status: "progress",
                  }
                : item
            )
          );
          break;
        }
        case "done": {
          const data = message.data as ModelLoadProgress;
          setProgressItems((prev) =>
            prev.map((item) =>
              item.file === data.file
                ? { ...item, progress: 100, status: "done" }
                : item
            )
          );
          break;
        }
        case "ready":
          setIsModelLoading(false);
          setIsModelReady(true);
          break;
        case "result":
          setResult(message.data);
          setIsProcessing(false);
          break;
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsProcessing(false);
          break;
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const loadModel = useCallback(() => {
    if (!workerRef.current) return;
    setIsModelLoading(true);
    setIsModelReady(false);
    setError(null);
    setProgressItems([]);
    workerRef.current.postMessage({ type: "load", modelId });
  }, [modelId]);

  const processImage = useCallback((imageDataUrl: string) => {
    if (!workerRef.current) return;
    setIsProcessing(true);
    setResult(null);
    setError(null);
    workerRef.current.postMessage({ type: "process", imageData: imageDataUrl });
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  return {
    isModelLoading,
    isModelReady,
    isProcessing,
    progressItems,
    result,
    error,
    modelId,
    setModelId,
    loadModel,
    processImage,
    reset,
  };
}
