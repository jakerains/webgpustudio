"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatMessage, ChatProgressItem, ChatWorkerOutgoingMessage, ChatModelLoadProgress } from "@/types/chat";
import { AUDIO_INTELLIGENCE_MODELS, DEFAULT_AI_MODEL_ID } from "@/lib/audio-intelligence-constants";
import { audioBufferToFloat32Array } from "@/lib/audio-utils";
import { getCachedModelIds } from "@/lib/model-cache";

const TARGET_SAMPLE_RATE = 16000;

export type AIStatus = "idle" | "submitted" | "streaming" | "error";

interface AudioIntelligenceState {
  // Model state
  isModelLoading: boolean;
  isModelReady: boolean;
  progressItems: ChatProgressItem[];
  modelError: string | null;
  modelId: string;
  setModelId: (id: string) => void;
  loadModel: () => void;
  cachedModelIds: Set<string>;

  // Audio state
  audioUrl: string | null;
  hasAudio: boolean;
  isDecodingAudio: boolean;
  setAudioFromFile: (file: File) => void;
  setAudioFromRecording: (blob: Blob, rawAudio: Float32Array) => void;
  clearAudio: () => void;

  // Conversation state
  messages: ChatMessage[];
  isGenerating: boolean;
  streamingContent: string;
  generationError: string | null;
  input: string;
  setInput: (value: string) => void;
  status: AIStatus;

  // Actions
  handleSubmit: () => void;
  sendMessage: (text: string) => void;
  stop: () => void;
  setMessages: (messages: ChatMessage[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Decode an audio File into a mono Float32Array at the target sample rate.
 * Must run on the main thread because AudioContext is not available in Workers.
 */
async function decodeAudioFile(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBufferToFloat32Array(audioBuffer);
  } finally {
    await audioContext.close();
  }
}

export function useAudioIntelligence(): AudioIntelligenceState {
  const workerRef = useRef<Worker | null>(null);

  // Model state
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [progressItems, setProgressItems] = useState<ChatProgressItem[]>([]);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_AI_MODEL_ID);
  const [cachedModelIds, setCachedModelIds] = useState<Set<string>>(new Set());

  // Audio state — blob URL for preview, Float32Array for worker
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDecodingAudio, setIsDecodingAudio] = useState(false);
  const audioDataRef = useRef<Float32Array | null>(null);

  // Conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AIStatus>("idle");

  // Streaming buffer — raw tokens accumulate here
  const streamBufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  // Check which models are already cached in the browser
  const refreshCacheStatus = useCallback(async () => {
    const ids = AUDIO_INTELLIGENCE_MODELS.map((m) => m.id);
    const cached = await getCachedModelIds(ids);
    setCachedModelIds(cached);
  }, []);

  useEffect(() => {
    refreshCacheStatus();
  }, [refreshCacheStatus]);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../app/audio-intelligence/ai-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<ChatWorkerOutgoingMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "initiate": {
          const data = message.data as ChatModelLoadProgress;
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
          const data = message.data as ChatModelLoadProgress;
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
          const data = message.data as ChatModelLoadProgress;
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
        case "token": {
          const { token } = message.data;
          streamBufferRef.current += token;
          // Batch UI updates via rAF
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(() => {
              setStreamingContent(streamBufferRef.current);
              setStatus("streaming");
              rafRef.current = null;
            });
          }
          break;
        }
        case "complete": {
          const { content } = message.data;
          const assistantMessage: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content,
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent("");
          streamBufferRef.current = "";
          setIsGenerating(false);
          setStatus("idle");
          break;
        }
        case "error": {
          const errorMsg = message.data.message;
          // During model loading, set modelError; during generation, set generationError
          if (!isModelReady) {
            setModelError(errorMsg);
            setIsModelLoading(false);
          } else {
            setGenerationError(errorMsg);
          }
          setIsGenerating(false);
          setStreamingContent("");
          streamBufferRef.current = "";
          setStatus("error");
          break;
        }
      }
    };

    workerRef.current = worker;

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      worker.terminate();
    };
  }, []);

  // Audio management — file upload (needs decoding)
  const setAudioFromFile = useCallback((file: File) => {
    // Create blob URL for preview immediately
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    // Decode audio to Float32Array on the main thread
    setIsDecodingAudio(true);
    decodeAudioFile(file)
      .then((float32) => {
        audioDataRef.current = float32;
        setIsDecodingAudio(false);
      })
      .catch((err) => {
        console.error("Audio decode error:", err);
        setIsDecodingAudio(false);
        setGenerationError("Failed to decode audio file. Try a different format.");
      });
  }, []);

  // Audio management — recording (already have raw PCM)
  const setAudioFromRecording = useCallback((blob: Blob, rawAudio: Float32Array) => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    audioDataRef.current = rawAudio;
  }, []);

  const clearAudio = useCallback(() => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    audioDataRef.current = null;
    setMessages([]);
    setStreamingContent("");
    setGenerationError(null);
    streamBufferRef.current = "";
  }, []);

  const loadModel = useCallback(() => {
    if (!workerRef.current) return;
    const m = AUDIO_INTELLIGENCE_MODELS.find((m) => m.id === modelId);
    if (!m) return;

    setIsModelLoading(true);
    setIsModelReady(false);
    setModelError(null);
    setProgressItems([]);
    workerRef.current.postMessage({
      type: "load",
      modelId: m.id,
      dtype: m.dtype,
    });
  }, [modelId]);

  const doGenerate = useCallback(
    (prompt: string) => {
      if (!workerRef.current || !prompt.trim() || isGenerating) return;
      if (!audioDataRef.current) return;

      const m = AUDIO_INTELLIGENCE_MODELS.find((m) => m.id === modelId);
      if (!m) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: prompt.trim(),
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsGenerating(true);
      setGenerationError(null);
      setStreamingContent("");
      streamBufferRef.current = "";
      setStatus("submitted");

      // Transfer audio data to worker (copy — the buffer stays usable for future queries)
      workerRef.current.postMessage({
        type: "generate",
        audioData: audioDataRef.current,
        prompt: prompt.trim(),
        maxTokens: m.maxTokens,
      });
    },
    [isGenerating, modelId]
  );

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    doGenerate(input);
  }, [input, doGenerate]);

  const sendMessage = useCallback(
    (text: string) => {
      doGenerate(text);
    },
    [doGenerate]
  );

  const stop = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "abort" });

    // Commit whatever we have so far
    if (streamBufferRef.current) {
      const partialMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: streamBufferRef.current,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, partialMessage]);
    }

    setStreamingContent("");
    streamBufferRef.current = "";
    setIsGenerating(false);
    setStatus("idle");
  }, []);

  return {
    isModelLoading,
    isModelReady,
    progressItems,
    modelError,
    modelId,
    setModelId,
    loadModel,
    cachedModelIds,
    audioUrl,
    hasAudio: audioUrl !== null && !isDecodingAudio,
    isDecodingAudio,
    setAudioFromFile,
    setAudioFromRecording,
    clearAudio,
    messages,
    isGenerating,
    streamingContent,
    generationError,
    input,
    setInput,
    status,
    handleSubmit,
    sendMessage,
    stop,
    setMessages,
  };
}
