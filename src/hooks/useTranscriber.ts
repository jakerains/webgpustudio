"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  TranscriberData,
  TranscriberProgressItem,
  WorkerOutgoingMessage,
  ModelLoadProgress,
} from "@/types/transcriber";
import { DEFAULT_MODEL_ID, WHISPER_MODELS } from "@/lib/constants";
import { getCachedModelIds } from "@/lib/model-cache";

interface TranscriberState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isTranscribing: boolean;
  progressItems: TranscriberProgressItem[];
  transcript: TranscriberData | null;
  error: string | null;
  device: "webgpu" | "wasm";
  modelId: string;
  setDevice: (device: "webgpu" | "wasm") => void;
  setModelId: (modelId: string) => void;
  loadModel: () => void;
  transcribe: (audio: Float32Array) => void;
  cachedModelIds: Set<string>;
}

export function useTranscriber(): TranscriberState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progressItems, setProgressItems] = useState<TranscriberProgressItem[]>(
    []
  );
  const [transcript, setTranscript] = useState<TranscriberData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<"webgpu" | "wasm">("webgpu");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [cachedModelIds, setCachedModelIds] = useState<Set<string>>(new Set());

  const refreshCacheStatus = useCallback(async () => {
    const ids = WHISPER_MODELS.map((m) => m.id);
    const cached = await getCachedModelIds(ids);
    setCachedModelIds(cached);
  }, []);

  useEffect(() => {
    refreshCacheStatus();
  }, [refreshCacheStatus]);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(new URL("../app/worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
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
          refreshCacheStatus();
          break;
        case "update":
          setTranscript(message.data);
          break;
        case "complete":
          setTranscript(message.data);
          setIsTranscribing(false);
          break;
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsTranscribing(false);
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
    workerRef.current.postMessage({ type: "load", device, modelId });
  }, [device, modelId]);

  const transcribe = useCallback((audio: Float32Array) => {
    if (!workerRef.current) return;
    setIsTranscribing(true);
    setTranscript(null);
    setError(null);
    workerRef.current.postMessage({ type: "transcribe", audio });
  }, []);

  return {
    isModelLoading,
    isModelReady,
    isTranscribing,
    progressItems,
    transcript,
    error,
    device,
    modelId,
    setDevice,
    setModelId,
    loadModel,
    transcribe,
    cachedModelIds,
  };
}
