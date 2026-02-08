"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DEFAULT_TRANSLATION_MODEL_ID } from "@/lib/translation-constants";

interface ProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

interface TranslationState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isTranslating: boolean;
  progressItems: ProgressItem[];
  translatedText: string;
  error: string | null;
  modelId: string;
  setModelId: (id: string) => void;
  loadModel: () => void;
  translate: (text: string, srcLang: string, tgtLang: string) => void;
}

export function useTranslation(): TranslationState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [translatedText, setTranslatedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_TRANSLATION_MODEL_ID);

  useEffect(() => {
    const worker = new Worker(
      new URL("../app/translation/translation-worker.ts", import.meta.url),
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
          const { translatedText: text } = message.data as {
            translatedText: string;
          };
          setTranslatedText(text);
          setIsTranslating(false);
          break;
        }
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsTranslating(false);
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

  const translate = useCallback(
    (text: string, srcLang: string, tgtLang: string) => {
      if (!workerRef.current) return;
      setIsTranslating(true);
      setError(null);
      workerRef.current.postMessage({
        type: "translate",
        text,
        srcLang,
        tgtLang,
      });
    },
    []
  );

  return {
    isModelLoading,
    isModelReady,
    isTranslating,
    progressItems,
    translatedText,
    error,
    modelId,
    setModelId,
    loadModel,
    translate,
  };
}
