"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DEFAULT_SEGMENTATION_MODEL_ID,
  SEGMENTATION_MODELS,
} from "@/lib/segmentation-constants";

interface ProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

export interface MaskData {
  data: number[];
  width: number;
  height: number;
}

export interface ClickPoint {
  x: number;
  y: number;
  label: 0 | 1; // 1 = positive (include), 0 = negative (exclude)
}

interface SegmentationState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isSegmenting: boolean;
  progressItems: ProgressItem[];
  masks: MaskData[];
  scores: number[];
  selectedMaskIndex: number;
  setSelectedMaskIndex: (index: number) => void;
  error: string | null;
  modelId: string;
  setModelId: (id: string) => void;
  loadModel: () => void;
  segment: (imageDataUrl: string, clickPoints: ClickPoint[]) => void;
}

export function useSegmentation(): SegmentationState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [masks, setMasks] = useState<MaskData[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [selectedMaskIndex, setSelectedMaskIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_SEGMENTATION_MODEL_ID);

  useEffect(() => {
    const worker = new Worker(
      new URL("../app/image-segmentation/segment-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "initiate": {
          const data = message.data as Record<string, unknown>;
          setProgressItems((prev) => {
            const existing = prev.find((p) => p.file === (data.file as string));
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
        case "result": {
          const { masks: maskResults, scores: scoreResults } = message.data as {
            masks: MaskData[];
            scores: number[];
          };
          setMasks(maskResults);
          setScores(scoreResults || []);
          setSelectedMaskIndex(0); // Reset to best mask on new results
          setIsSegmenting(false);
          break;
        }
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsSegmenting(false);
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
    // Find the model config to pass dtype to the worker
    const modelConfig = SEGMENTATION_MODELS.find((m) => m.id === modelId);
    workerRef.current.postMessage({
      type: "load",
      modelId,
      dtype: modelConfig?.dtype,
    });
  }, [modelId]);

  const segment = useCallback(
    (imageDataUrl: string, clickPoints: ClickPoint[]) => {
      if (!workerRef.current) return;
      setIsSegmenting(true);
      setError(null);
      workerRef.current.postMessage({
        type: "segment",
        imageData: imageDataUrl,
        points: clickPoints,
      });
    },
    []
  );

  return {
    isModelLoading,
    isModelReady,
    isSegmenting,
    progressItems,
    masks,
    scores,
    selectedMaskIndex,
    setSelectedMaskIndex,
    error,
    modelId,
    setModelId,
    loadModel,
    segment,
  };
}
