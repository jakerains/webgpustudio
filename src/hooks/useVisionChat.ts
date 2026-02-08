"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatMessage, ChatProgressItem, ChatWorkerOutgoingMessage, ChatModelLoadProgress } from "@/types/chat";
import {
  VISION_CHAT_MODELS,
  DEFAULT_VISION_CHAT_MODEL_ID,
} from "@/lib/vision-chat-constants";
import { getCachedModelIds } from "@/lib/model-cache";

export type VisionChatStatus = "idle" | "submitted" | "streaming" | "error";

interface VisionChatState {
  // Model state
  isModelLoading: boolean;
  isModelReady: boolean;
  progressItems: ChatProgressItem[];
  modelError: string | null;
  modelId: string;
  setModelId: (id: string) => void;
  loadModel: () => void;
  cachedModelIds: Set<string>;

  // Chat state
  messages: ChatMessage[];
  isGenerating: boolean;
  streamingContent: string;
  input: string;
  setInput: (value: string) => void;
  status: VisionChatStatus;

  // Image state
  imageUrl: string | null;
  setImageUrl: (url: string | null) => void;

  // Actions
  handleSubmit: () => void;
  stop: () => void;
  setMessages: (messages: ChatMessage[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function useVisionChat(): VisionChatState {
  const workerRef = useRef<Worker | null>(null);

  // Model state
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [progressItems, setProgressItems] = useState<ChatProgressItem[]>([]);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_VISION_CHAT_MODEL_ID);
  const [cachedModelIds, setCachedModelIds] = useState<Set<string>>(new Set());

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<VisionChatStatus>("idle");

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Streaming buffer
  const streamBufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  // Check which models are already cached
  const refreshCacheStatus = useCallback(async () => {
    const ids = VISION_CHAT_MODELS.map((m) => m.id);
    const cached = await getCachedModelIds(ids);
    setCachedModelIds(cached);
  }, []);

  useEffect(() => {
    refreshCacheStatus();
  }, [refreshCacheStatus]);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../app/vision-chat/vision-worker.ts", import.meta.url),
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
            content: content,
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent("");
          streamBufferRef.current = "";
          setIsGenerating(false);
          setStatus("idle");
          break;
        }
        case "error":
          setModelError(message.data.message);
          setIsModelLoading(false);
          setIsGenerating(false);
          setStreamingContent("");
          streamBufferRef.current = "";
          setStatus("error");
          break;
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

  const loadModel = useCallback(() => {
    if (!workerRef.current) return;
    const model = VISION_CHAT_MODELS.find((m) => m.id === modelId);
    if (!model) return;

    setIsModelLoading(true);
    setIsModelReady(false);
    setModelError(null);
    setProgressItems([]);
    workerRef.current.postMessage({
      type: "load",
      modelId: model.id,
      dtype: model.dtype,
    });
  }, [modelId]);

  const handleSubmit = useCallback(() => {
    if (!workerRef.current || !input.trim() || isGenerating || !imageUrl) return;

    const model = VISION_CHAT_MODELS.find((m) => m.id === modelId);
    if (!model) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsGenerating(true);
    setStreamingContent("");
    streamBufferRef.current = "";
    setStatus("submitted");

    // Build worker messages — mark first user message as having the image
    const isFirstUserMessage = !messages.some((m) => m.role === "user");
    const workerMessages = updatedMessages.map((m, i) => ({
      role: m.role,
      content: m.content,
      hasImage: m.role === "user" && (isFirstUserMessage ? m.id === userMessage.id : i === messages.findIndex((msg) => msg.role === "user")),
    }));

    // Always attach image to the first user message in conversation
    const firstUserIdx = workerMessages.findIndex((m) => m.role === "user");
    const markedMessages = workerMessages.map((m, i) => ({
      ...m,
      hasImage: i === firstUserIdx,
    }));

    workerRef.current.postMessage({
      type: "generate",
      imageData: imageUrl,
      messages: markedMessages,
      maxTokens: model.maxTokens,
    });
  }, [input, isGenerating, messages, modelId, imageUrl]);

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
    messages,
    isGenerating,
    streamingContent,
    input,
    setInput,
    status,
    imageUrl,
    setImageUrl,
    handleSubmit,
    stop,
    setMessages,
  };
}
