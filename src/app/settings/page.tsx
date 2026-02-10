"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Trash2, HardDrive, AlertTriangle } from "lucide-react";
import { clearAllModelCache, estimateCacheSize, getCachedModelIds } from "@/lib/model-cache";
import { WHISPER_MODELS } from "@/lib/constants";
import { BG_REMOVAL_MODELS } from "@/lib/bg-removal-constants";
import { DETECTION_MODELS } from "@/lib/detection-constants";
import { DEPTH_MODELS } from "@/lib/depth-constants";
import { SEGMENTATION_MODELS } from "@/lib/segmentation-constants";
import { TTS_MODELS } from "@/lib/tts-constants";
import { CHAT_MODELS } from "@/lib/chat-constants";
import { AUDIO_INTELLIGENCE_MODELS } from "@/lib/audio-intelligence-constants";

interface ModelInfo {
  id: string;
  label: string;
  size: string;
  category: string;
}

// Collect all models from every feature
const ALL_MODELS: ModelInfo[] = [
  ...CHAT_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Chat" })),
  ...AUDIO_INTELLIGENCE_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Audio Intelligence" })),
  ...WHISPER_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Speech to Text" })),
  ...TTS_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Text to Speech" })),
  ...BG_REMOVAL_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Background Removal" })),
  ...DETECTION_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Object Detection" })),
  ...DEPTH_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Depth Estimation" })),
  ...SEGMENTATION_MODELS.map((m) => ({ id: m.id, label: m.label, size: m.size, category: "Image Segmentation" })),
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function SettingsPage() {
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isClearing, setIsClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const refreshStatus = useCallback(async () => {
    const ids = ALL_MODELS.map((m) => m.id);
    const cached = await getCachedModelIds(ids);
    setCachedIds(cached);
    const size = await estimateCacheSize();
    setCacheSize(size);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleClearAll = async () => {
    setIsClearing(true);
    await clearAllModelCache();
    setCachedIds(new Set());
    const size = await estimateCacheSize();
    setCacheSize(size);
    setIsClearing(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  const cachedModels = ALL_MODELS.filter((m) => cachedIds.has(m.id));
  const cachedCount = cachedModels.length;

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <header className="text-center mb-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="p-2.5 rounded-xl"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <Settings className="w-7 h-7" style={{ color: "var(--accent)" }} />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Settings
            </h1>
          </div>
          <p
            className="text-sm max-w-md mx-auto leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Manage cached models and storage
          </p>
        </header>

        {/* Cache Overview */}
        <div
          className="card p-6 mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center gap-2.5 mb-5">
            <HardDrive className="w-[18px] h-[18px]" style={{ color: "var(--muted)" }} />
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Model Cache
            </h2>
          </div>

          {/* Stats */}
          <div
            className="flex items-center gap-6 p-4 rounded-xl mb-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {cachedCount}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                Models cached
              </p>
            </div>
            <div
              className="w-px h-10"
              style={{ background: "var(--border-subtle)" }}
            />
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {formatBytes(cacheSize)}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                Storage used
              </p>
            </div>
          </div>

          <p className="text-xs mb-4" style={{ color: "var(--muted-light)" }}>
            Models are cached in your browser so they load instantly next time.
            Clearing the cache will require re-downloading models when you use them again.
          </p>

          {/* Clear All Button */}
          <button
            onClick={handleClearAll}
            disabled={isClearing || cachedCount === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: cleared
                ? "var(--success)"
                : cachedCount === 0
                  ? "var(--surface)"
                  : "var(--error)",
              color: cachedCount === 0 ? "var(--muted)" : "#FFFFFF",
              border: cachedCount === 0 ? "1px solid var(--border-subtle)" : "none",
              boxShadow:
                cachedCount > 0 && !cleared
                  ? "0 2px 12px rgba(194, 84, 84, 0.3)"
                  : "none",
            }}
          >
            {isClearing ? (
              <>
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                />
                Clearing...
              </>
            ) : cleared ? (
              "Cache Cleared"
            ) : cachedCount === 0 ? (
              "No Models Cached"
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Clear All Cached Models
              </>
            )}
          </button>
        </div>

        {/* Cached Models List */}
        {cachedCount > 0 && (
          <div
            className="card p-6 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Cached Models
            </h3>
            <div className="space-y-2">
              {cachedModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <HardDrive
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--success)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {model.label}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--muted-light)" }}
                    >
                      {model.category} &middot; {model.size}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning */}
        <div
          className="mt-6 flex items-start gap-2 p-4 rounded-xl animate-fade-in-up"
          style={{
            animationDelay: "0.3s",
            background: "var(--warning-bg, rgba(234, 179, 8, 0.1))",
            border: "1px solid var(--warning-border, rgba(234, 179, 8, 0.2))",
          }}
        >
          <AlertTriangle
            className="w-4 h-4 mt-0.5 shrink-0"
            style={{ color: "var(--warning, #b8860b)" }}
          />
          <p className="text-xs leading-relaxed" style={{ color: "var(--warning, #b8860b)" }}>
            Cache is stored in your browser. Clearing browser data or using
            incognito mode will also remove cached models.
          </p>
        </div>
      </div>
    </main>
  );
}
