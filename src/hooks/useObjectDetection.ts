"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DEFAULT_DETECTION_MODEL_ID,
  DETECTION_MODELS,
} from "@/lib/detection-constants";
import { getCachedModelIds } from "@/lib/model-cache";

export interface DetectionBox {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface ProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

interface UseObjectDetectionState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isDetecting: boolean;
  progressItems: ProgressItem[];
  detections: DetectionBox[];
  error: string | null;
  modelId: string;
  setModelId: (modelId: string) => void;
  loadModel: () => void;
  detect: (
    imageDataUrl: string,
    threshold?: number,
    candidateLabels?: string
  ) => void;
  cachedModelIds: Set<string>;
}

export function useObjectDetection(): UseObjectDetectionState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_DETECTION_MODEL_ID);
  const [cachedModelIds, setCachedModelIds] = useState<Set<string>>(new Set());

  const refreshCacheStatus = useCallback(async () => {
    const ids = DETECTION_MODELS.map((m) => m.id);
    const cached = await getCachedModelIds(ids);
    setCachedModelIds(cached);
  }, []);

  useEffect(() => {
    refreshCacheStatus();
  }, [refreshCacheStatus]);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../app/object-detection/detection-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "initiate": {
          const data = message.data as Record<string, unknown>;
          setProgressItems((prev) => {
            const existing = prev.find((p) => p.file === data.file);
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
              item.file === data.file
                ? {
                    ...item,
                    progress: (data.progress as number) ?? item.progress,
                    loaded: (data.loaded as number) ?? item.loaded,
                    total: (data.total as number) ?? item.total,
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
          refreshCacheStatus();
          break;
        case "result":
          setDetections(message.data.boxes);
          setIsDetecting(false);
          break;
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsDetecting(false);
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

    // Look up pipelineType from model registry
    const modelConfig = DETECTION_MODELS.find((m) => m.id === modelId);
    const pipelineType = modelConfig?.pipelineType ?? "object-detection";

    workerRef.current.postMessage({ type: "load", modelId, pipelineType });
  }, [modelId]);

  const detect = useCallback(
    (
      imageDataUrl: string,
      threshold: number = 0.5,
      candidateLabels?: string
    ) => {
      if (!workerRef.current) return;
      setIsDetecting(true);
      setError(null);
      workerRef.current.postMessage({
        type: "detect",
        imageData: imageDataUrl,
        threshold,
        candidateLabels,
      });
    },
    []
  );

  return {
    isModelLoading,
    isModelReady,
    isDetecting,
    progressItems,
    detections,
    error,
    modelId,
    setModelId,
    loadModel,
    detect,
    cachedModelIds,
  };
}
