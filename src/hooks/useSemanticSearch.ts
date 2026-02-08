"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DEFAULT_SEARCH_MODEL_ID } from "@/lib/search-constants";

interface ProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

interface SearchResult {
  text: string;
  score: number;
  index: number;
}

interface SemanticSearchState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isIndexing: boolean;
  isSearching: boolean;
  progressItems: ProgressItem[];
  results: SearchResult[];
  indexedCount: number;
  error: string | null;
  modelId: string;
  setModelId: (id: string) => void;
  loadModel: () => void;
  indexDocuments: (texts: string[]) => void;
  search: (query: string, topK?: number) => void;
}

export function useSemanticSearch(): SemanticSearchState {
  const workerRef = useRef<Worker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [indexedCount, setIndexedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_SEARCH_MODEL_ID);

  useEffect(() => {
    const worker = new Worker(
      new URL("../app/semantic-search/search-worker.ts", import.meta.url),
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
        case "indexed": {
          const { count } = message.data as { count: number };
          setIndexedCount(count);
          setIsIndexing(false);
          break;
        }
        case "results": {
          const { results: searchResults } = message.data as {
            results: SearchResult[];
          };
          setResults(searchResults);
          setIsSearching(false);
          break;
        }
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsIndexing(false);
          setIsSearching(false);
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

  const indexDocuments = useCallback((texts: string[]) => {
    if (!workerRef.current) return;
    setIsIndexing(true);
    setError(null);
    setResults([]);
    workerRef.current.postMessage({ type: "index", documents: texts });
  }, []);

  const search = useCallback((query: string, topK: number = 5) => {
    if (!workerRef.current) return;
    setIsSearching(true);
    setError(null);
    workerRef.current.postMessage({ type: "search", query, topK });
  }, []);

  return {
    isModelLoading,
    isModelReady,
    isIndexing,
    isSearching,
    progressItems,
    results,
    indexedCount,
    error,
    modelId,
    setModelId,
    loadModel,
    indexDocuments,
    search,
  };
}
