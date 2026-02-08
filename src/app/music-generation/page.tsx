"use client";

import { useState, useMemo } from "react";
import {
  Settings,
  Download,
  CheckCircle2,
  AlertCircle,
  Music,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { PromptInput } from "@/components/music/PromptInput";
import { GenerationProgress } from "@/components/music/GenerationProgress";
import { AudioPlayer } from "@/components/shared/AudioPlayer";
import { useMusicGeneration } from "@/hooks/useMusicGeneration";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { MUSIC_MODELS } from "@/lib/music-constants";

function float32ToWav(audioData: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = audioData.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export default function MusicGenerationPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const music = useMusicGeneration();
  const [prompt, setPrompt] = useState("");

  const selectedModel =
    MUSIC_MODELS.find((m) => m.id === music.modelId) ?? MUSIC_MODELS[0];

  const audioUrl = useMemo(() => {
    if (!music.audioResult) return null;
    const wav = float32ToWav(
      music.audioResult.audio,
      music.audioResult.samplingRate
    );
    return URL.createObjectURL(wav);
  }, [music.audioResult]);

  const handleGenerate = () => {
    if (prompt.trim()) {
      music.generate(prompt.trim());
    }
  };

  const duration = music.audioResult
    ? (music.audioResult.audio.length / music.audioResult.samplingRate).toFixed(
        1
      )
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
              <Music className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                Music Generation
              </h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Generate music from text descriptions using WebGPU
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
              WebGPU is not supported in this browser.
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
                music.isModelReady
                  ? "ready"
                  : music.isModelLoading
                    ? "loading"
                    : music.error
                      ? "error"
                      : "idle"
              }
            />
          </div>

          {!music.isModelReady && (
            <>
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
                  MusicGen is a large model ({selectedModel.size}). Make sure
                  you have a stable connection and sufficient GPU memory.
                </span>
              </div>

              <div className="mb-5">
                <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                  {selectedModel.label} — {selectedModel.size} —{" "}
                  {selectedModel.description}
                </p>
              </div>

              <button
                onClick={music.loadModel}
                disabled={music.isModelLoading}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  music.isModelLoading
                    ? "cursor-wait"
                    : "hover:brightness-110 active:scale-[0.99]"
                )}
                style={{
                  background: music.isModelLoading
                    ? "var(--accent-bg)"
                    : "var(--accent)",
                  color: music.isModelLoading ? "var(--accent)" : "#FFFFFF",
                  border: music.isModelLoading
                    ? "1px solid var(--accent-border)"
                    : "none",
                  boxShadow: music.isModelLoading
                    ? "none"
                    : "0 2px 12px rgba(194, 114, 78, 0.3)",
                }}
              >
                {music.isModelLoading ? (
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
                    Load MusicGen Model
                  </>
                )}
              </button>

              <ProgressBar items={music.progressItems} />

              {music.error && (
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
                    {music.error}
                  </p>
                </div>
              )}
            </>
          )}

          {music.isModelReady && (
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
          )}
        </div>

        {/* Prompt & Generation */}
        {music.isModelReady && (
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
              Describe Your Music
            </h3>

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              disabled={music.isGenerating}
            />

            <button
              onClick={handleGenerate}
              disabled={music.isGenerating || !prompt.trim()}
              className={clsx(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all mt-4",
                music.isGenerating || !prompt.trim()
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:brightness-110 active:scale-[0.99]"
              )}
              style={{
                background:
                  music.isGenerating || !prompt.trim()
                    ? "var(--accent-bg)"
                    : "var(--accent)",
                color:
                  music.isGenerating || !prompt.trim()
                    ? "var(--accent)"
                    : "#FFFFFF",
                border:
                  music.isGenerating || !prompt.trim()
                    ? "1px solid var(--accent-border)"
                    : "none",
                boxShadow:
                  music.isGenerating || !prompt.trim()
                    ? "none"
                    : "0 2px 12px rgba(194, 114, 78, 0.3)",
              }}
            >
              {music.isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  Generate Music
                </>
              )}
            </button>
          </div>
        )}

        {/* Generation Progress */}
        {music.isGenerating && (
          <div className="mb-6">
            <GenerationProgress isGenerating={music.isGenerating} />
          </div>
        )}

        {/* Audio Playback */}
        {audioUrl && music.audioResult && (
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
              Generated Music
            </h3>

            <AudioPlayer audioUrl={audioUrl} filename="generated-music.wav" />

            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Duration: {duration}s
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--muted-light)" }}
              >
                Sample rate: {music.audioResult.samplingRate} Hz
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
              MusicGen
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
