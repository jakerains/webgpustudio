"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Settings,
  Download,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { clsx } from "clsx";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { VoiceSelector } from "@/components/tts/VoiceSelector";
import { AudioPlayer } from "@/components/shared/AudioPlayer";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { TTS_MODELS } from "@/lib/tts-constants";
import { float32ToWav } from "@/lib/canvas-utils";

const LFM_AUDIO_MODEL_ID = "LiquidAI/LFM2.5-Audio-1.5B-ONNX";

export default function TextToSpeechPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const tts = useTextToSpeech();
  const [text, setText] = useState("");

  const selectedModel =
    TTS_MODELS.find((m) => m.id === tts.modelId) ?? TTS_MODELS[0];
  const isLfmSelected = selectedModel.id === LFM_AUDIO_MODEL_ID;

  const audioUrl = useMemo(() => {
    if (!tts.audioResult) return null;
    const wav = float32ToWav(tts.audioResult.audio, tts.audioResult.samplingRate);
    return URL.createObjectURL(wav);
  }, [tts.audioResult]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleSynthesize = () => {
    if (text.trim()) {
      tts.synthesize(text.trim());
    }
  };

  const duration = tts.audioResult
    ? (tts.audioResult.audio.length / tts.audioResult.samplingRate).toFixed(1)
    : null;

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <Volume2 className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                Text to Speech
              </h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Convert text to natural-sounding speech using WebGPU
              </p>
            </div>
          </div>

          {!isCheckingWebGPU && !isWebGPUSupported && (
            <div
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{
                background: "var(--warning-bg)",
                border: "1px solid var(--warning-border)",
                color: "var(--warning)",
              }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              WebGPU is not supported in this browser. TTS may fall back to WASM.
            </div>
          )}
        </div>

        {/* Model Setup */}
        <div
          className="card p-6 mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Settings
                className="w-[18px] h-[18px]"
                style={{ color: "var(--muted)" }}
              />
              <h2
                className="text-base font-semibold"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                Model Setup
              </h2>
            </div>
            <StatusIndicator
              status={
                tts.isModelReady
                  ? "ready"
                  : tts.isModelLoading
                    ? "loading"
                    : tts.error
                      ? "error"
                      : "idle"
              }
            />
          </div>

          {!tts.isModelReady && (
            <>
              {isLfmSelected && (
                <div
                  className="mb-4 flex items-start gap-2 p-3 rounded-xl text-xs"
                  style={{
                    background: "var(--warning-bg)",
                    border: "1px solid var(--warning-border)",
                    color: "var(--warning)",
                  }}
                >
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    LFM2.5 Audio is a large model ({selectedModel.size}). Click
                    load to start a one-time download to browser cache.
                  </span>
                </div>
              )}

              <div className="mb-5">
                <label
                  className="text-xs font-medium mb-2 block"
                  style={{ color: "var(--muted)" }}
                >
                  Model
                </label>
                <div className="relative">
                  <select
                    value={tts.modelId}
                    onChange={(e) => tts.setModelId(e.target.value)}
                    disabled={tts.isModelLoading}
                    className={clsx(
                      "w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-medium transition-all focus:outline-none",
                      tts.isModelLoading && "opacity-40 cursor-not-allowed"
                    )}
                    style={{
                      background: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {TTS_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label} — {model.size}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "var(--muted-light)" }}
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--muted-light)" }}>
                  {selectedModel.description}
                </p>
              </div>

              <div className="mb-4">
                <VoiceSelector
                  modelLabel={selectedModel.label}
                  voiceProfile={selectedModel.voiceProfile}
                  supportsInterleaved={selectedModel.supportsInterleaved}
                />
              </div>

              <button
                onClick={tts.loadModel}
                disabled={tts.isModelLoading}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  tts.isModelLoading
                    ? "cursor-wait"
                    : "hover:brightness-110 active:scale-[0.99]"
                )}
                style={{
                  background: tts.isModelLoading
                    ? "var(--accent-bg)"
                    : "var(--accent)",
                  color: tts.isModelLoading ? "var(--accent)" : "#FFFFFF",
                  border: tts.isModelLoading
                    ? "1px solid var(--accent-border)"
                    : "none",
                  boxShadow: tts.isModelLoading
                    ? "none"
                    : "0 2px 12px rgba(194, 114, 78, 0.3)",
                }}
              >
                {tts.isModelLoading ? (
                  <>
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: "var(--accent-border)",
                        borderTopColor: "var(--accent)",
                      }}
                    />
                    Loading Model...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Load TTS Model
                  </>
                )}
              </button>

              <ProgressBar items={tts.progressItems} />

              {tts.error && (
                <div
                  className="mt-4 flex items-start gap-2 p-3 rounded-xl"
                  style={{
                    background: "var(--error-bg)",
                    border: "1px solid var(--error-border)",
                  }}
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: "var(--error)" }}
                  />
                  <p className="text-sm" style={{ color: "var(--error)" }}>
                    {tts.error}
                  </p>
                </div>
              )}
            </>
          )}

          {tts.isModelReady && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: "var(--success-bg)",
                  border: "1px solid var(--success-border)",
                }}
              >
                <CheckCircle2
                  className="w-5 h-5"
                  style={{ color: "var(--success)" }}
                />
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--success)" }}
                  >
                    Model Ready
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--success)", opacity: 0.7 }}
                  >
                    {selectedModel.label} loaded on WebGPU
                  </p>
                </div>
              </div>

              <div>
                <label
                  className="text-xs font-medium mb-2 block"
                  style={{ color: "var(--muted)" }}
                >
                  Switch Model
                </label>
                <div className="relative">
                  <select
                    value={tts.modelId}
                    onChange={(e) => tts.setModelId(e.target.value)}
                    className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-medium transition-all focus:outline-none"
                    style={{
                      background: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {TTS_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label} — {model.size}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "var(--muted-light)" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Text Input & Synthesis */}
        {tts.isModelReady && (
          <div
            className="card p-6 mb-6 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Enter Text
            </h3>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to speak..."
              rows={5}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition-colors mb-4"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                color: "var(--foreground)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
              }}
            />

            <button
              onClick={handleSynthesize}
              disabled={tts.isSynthesizing || !text.trim()}
              className={clsx(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                tts.isSynthesizing || !text.trim()
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:brightness-110 active:scale-[0.99]"
              )}
              style={{
                background:
                  tts.isSynthesizing || !text.trim()
                    ? "var(--accent-bg)"
                    : "var(--accent)",
                color:
                  tts.isSynthesizing || !text.trim()
                    ? "var(--accent)"
                    : "#FFFFFF",
                border:
                  tts.isSynthesizing || !text.trim()
                    ? "1px solid var(--accent-border)"
                    : "none",
                boxShadow:
                  tts.isSynthesizing || !text.trim()
                    ? "none"
                    : "0 2px 12px rgba(194, 114, 78, 0.3)",
              }}
            >
              {tts.isSynthesizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Generate Speech
                </>
              )}
            </button>
          </div>
        )}

        {/* Audio Playback */}
        {audioUrl && tts.audioResult && (
          <div
            className="card p-6 mb-6 animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Audio Output
            </h3>

            <AudioPlayer audioUrl={audioUrl} filename="speech.wav" />

            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Duration: {duration}s
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--muted-light)" }}
              >
                Sample rate: {tts.audioResult.samplingRate} Hz
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center">
          <div
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: "var(--muted)" }}
          >
            <span>Powered by</span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Transformers.js
            </span>
            <span>&</span>
            <span
              className="font-medium"
              style={{ color: "var(--foreground)" }}
            >
              {selectedModel.label}
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--muted-light)" }}
          >
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
