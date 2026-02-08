"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DEFAULT_DEPTH_MODEL_ID } from "@/lib/depth-constants";

interface ProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

export interface DepthResult {
  width: number;
  height: number;
  values: number[];
}

interface DepthEstimationState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isProcessing: boolean;
  progressItems: ProgressItem[];
  depthResult: DepthResult | null;
  error: string | null;
  modelId: string;
  setModelId: (modelId: string) => void;
  loadModel: () => void;
  estimateDepth: (imageDataUrl: string) => void;
}

export function useDepthEstimation(): DepthEstimationState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [depthResult, setDepthResult] = useState<DepthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_DEPTH_MODEL_ID);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../app/depth-estimation/depth-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "initiate": {
          const data = message.data as Record<string, unknown>;
          setProgressItems((prev) => {
            const existing = prev.find(
              (p) => p.file === (data.file as string)
            );
            if (existing) return prev;
            return [
              ...prev,
              {
                file: (data.file as string) || "unknown",
                progress: 0,
                loaded: 0,
                total: 0,
                name: data.name as string | undefined,
                status: "initiate",
              },
            ];
          });
          break;
        }
        case "progress": {
          const data = message.data as Record<string, unknown>;
          setProgressItems((prev) =>
            prev.map((item) =>
              item.file === (data.file as string)
                ? {
                    ...item,
                    progress:
                      (data.progress as number | undefined) ?? item.progress,
                    loaded:
                      (data.loaded as number | undefined) ?? item.loaded,
                    total: (data.total as number | undefined) ?? item.total,
                    status: "progress",
                  }
                : item
            )
          );
          break;
        }
        case "done": {
          const data = message.data as Record<string, unknown>;
          setProgressItems((prev) =>
            prev.map((item) =>
              item.file === (data.file as string)
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
          setDepthResult(message.data as DepthResult);
          setIsProcessing(false);
          break;
        case "error":
          setError(
            (message.data as { message: string }).message
          );
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

  const estimateDepth = useCallback((imageDataUrl: string) => {
    if (!workerRef.current) return;
    setIsProcessing(true);
    setDepthResult(null);
    setError(null);
    workerRef.current.postMessage({ type: "estimate", imageData: imageDataUrl });
  }, []);

  return {
    isModelLoading,
    isModelReady,
    isProcessing,
    progressItems,
    depthResult,
    error,
    modelId,
    setModelId,
    loadModel,
    estimateDepth,
  };
}
