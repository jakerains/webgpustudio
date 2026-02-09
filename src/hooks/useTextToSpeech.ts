"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DEFAULT_TTS_MODEL_ID } from "@/lib/tts-constants";

interface ProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

interface ModelLoadProgress {
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  name?: string;
  status?: string;
}

interface AudioResult {
  audio?: Float32Array;
  samplingRate?: number;
  wavBuffer?: ArrayBuffer;
}

interface TextToSpeechState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isSynthesizing: boolean;
  progressItems: ProgressItem[];
  audioResult: AudioResult | null;
  error: string | null;
  modelId: string;
  speakerId: string;
  setModelId: (id: string) => void;
  setSpeakerId: (id: string) => void;
  loadModel: () => void;
  synthesize: (text: string) => void;
}

export function useTextToSpeech(): TextToSpeechState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [audioResult, setAudioResult] = useState<AudioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelIdState] = useState(DEFAULT_TTS_MODEL_ID);
  const [speakerId, setSpeakerId] = useState("af_heart");

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../app/text-to-speech/tts-worker.ts", import.meta.url),
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
        case "result": {
          const { audio, samplingRate, wavBuffer } = message.data;
          if (wavBuffer) {
            setAudioResult({ wavBuffer });
          } else {
            setAudioResult({ audio, samplingRate });
          }
          setIsSynthesizing(false);
          break;
        }
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsSynthesizing(false);
          break;
      }
    };

    workerRef.current = worker;

    return () => {
      worker.postMessage({ type: "dispose" });
      worker.terminate();
    };
  }, []);

  const setModelId = useCallback((id: string) => {
    setModelIdState(id);
    setIsModelReady(false);
    setIsSynthesizing(false);
    setProgressItems([]);
    setAudioResult(null);
    setError(null);
  }, []);

  const loadModel = useCallback(() => {
    if (!workerRef.current) return;
    setIsModelLoading(true);
    setIsModelReady(false);
    setError(null);
    setProgressItems([]);
    workerRef.current.postMessage({ type: "load", modelId });
  }, [modelId]);

  const synthesize = useCallback((text: string) => {
    if (!workerRef.current) return;
    setIsSynthesizing(true);
    setAudioResult(null);
    setError(null);
    workerRef.current.postMessage({ type: "synthesize", text, speakerId });
  }, [speakerId]);

  return {
    isModelLoading,
    isModelReady,
    isSynthesizing,
    progressItems,
    audioResult,
    error,
    modelId,
    speakerId,
    setModelId,
    setSpeakerId,
    loadModel,
    synthesize,
  };
}
