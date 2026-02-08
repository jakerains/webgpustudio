"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  Radio,
  Speech,
} from "lucide-react";
import { clsx } from "clsx";
import { StatusIndicator } from "@/components/StatusIndicator";
import { ProgressBar } from "@/components/ProgressBar";
import { AudioPlayer } from "@/components/shared/AudioPlayer";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { useLfmAudio } from "@/hooks/useLfmAudio";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import {
  LFM_AUDIO_MODEL,
  LFM_AUDIO_MODES,
  type LfmAudioMode,
} from "@/lib/lfm-audio-constants";
import { float32ToWav } from "@/lib/canvas-utils";
import { audioBufferToFloat32Array } from "@/lib/audio-utils";

export default function LfmAudioPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const lfm = useLfmAudio();
  const recorder = useAudioRecorder();
  const { isSessionActive, stopContinuousSession } = lfm;

  const [mode, setMode] = useState<LfmAudioMode>("asr");
  const [ttsText, setTtsText] = useState(
    "Hello from WebGPU Studio. This is LFM2.5 Audio speaking in your browser."
  );

  const ttsUrl = useMemo(() => {
    if (!lfm.ttsAudio) return null;
    const wav = float32ToWav(lfm.ttsAudio.audio, lfm.ttsAudio.samplingRate);
    return URL.createObjectURL(wav);
  }, [lfm.ttsAudio]);

  useEffect(() => {
    return () => {
      if (ttsUrl) {
        URL.revokeObjectURL(ttsUrl);
      }
    };
  }, [ttsUrl]);

  useEffect(() => {
    if (mode !== "interleaved" && isSessionActive) {
      stopContinuousSession();
    }
  }, [mode, isSessionActive, stopContinuousSession]);

  const handleAsrRecording = async () => {
    if (!recorder.isRecording) {
      await recorder.startRecording();
      return;
    }

    const audio = await recorder.stopRecording();
    if (audio) {
      lfm.transcribe(audio, 16000);
    }
  };

  const handleAsrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const decodeContext = new AudioContext();

    try {
      const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
      const samples = audioBufferToFloat32Array(audioBuffer);
      lfm.transcribe(samples, audioBuffer.sampleRate);
    } finally {
      await decodeContext.close();
      event.target.value = "";
    }
  };

  const modelStatus = lfm.isModelReady
    ? "ready"
    : lfm.isModelLoading
      ? "loading"
      : lfm.error
        ? "error"
        : "idle";

  const canRun = lfm.isModelReady && !lfm.isModelLoading;

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <Radio className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--foreground)",
                }}
              >
                LFM Audio Studio
              </h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                ASR, TTS, and interleaved voice turns powered by LFM2.5 Audio
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
              WebGPU is not supported in this browser. LFM Audio may not run.
            </div>
          )}
        </div>

        <section className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Model Setup
            </h2>
            <StatusIndicator status={modelStatus} />
          </div>

          {!lfm.isModelReady && (
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
                  {LFM_AUDIO_MODEL.label} is a large download ({LFM_AUDIO_MODEL.size}).
                  Loading is explicit opt-in and cached in your browser.
                </span>
              </div>

              <p className="text-xs mb-4" style={{ color: "var(--muted-light)" }}>
                {LFM_AUDIO_MODEL.description}
              </p>

              <button
                onClick={lfm.loadModel}
                disabled={lfm.isModelLoading}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  lfm.isModelLoading
                    ? "cursor-wait"
                    : "hover:brightness-110 active:scale-[0.99]"
                )}
                style={{
                  background: lfm.isModelLoading ? "var(--accent-bg)" : "var(--accent)",
                  color: lfm.isModelLoading ? "var(--accent)" : "#FFFFFF",
                  border: lfm.isModelLoading ? "1px solid var(--accent-border)" : "none",
                  boxShadow: lfm.isModelLoading
                    ? "none"
                    : "0 2px 12px rgba(194, 114, 78, 0.3)",
                }}
              >
                {lfm.isModelLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading Model...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Load LFM2.5 Audio
                  </>
                )}
              </button>

              <ProgressBar items={lfm.progressItems} />

              {lfm.error && (
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
                    {lfm.error}
                  </p>
                </div>
              )}
            </>
          )}

          {lfm.isModelReady && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
              }}
            >
              <CheckCircle2 className="w-5 h-5" style={{ color: "var(--success)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--success)" }}>
                  Model Ready
                </p>
                <p className="text-xs" style={{ color: "var(--success)", opacity: 0.7 }}>
                  {LFM_AUDIO_MODEL.label} loaded on WebGPU
                </p>
              </div>
            </div>
          )}
        </section>

        {lfm.isModelReady && (
          <>
            <section className="card p-3 mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="grid grid-cols-3 gap-2">
                {LFM_AUDIO_MODES.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMode(item.id)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: mode === item.id ? "var(--accent-bg)" : "var(--surface)",
                      color: mode === item.id ? "var(--accent)" : "var(--muted)",
                      border:
                        mode === item.id
                          ? "1px solid var(--accent-border)"
                          : "1px solid var(--border-subtle)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            {mode === "asr" && (
              <section className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
                <h3
                  className="text-sm font-semibold mb-4"
                  style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
                >
                  Speech to Text
                </h3>

                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={handleAsrRecording}
                    disabled={!canRun || lfm.isTranscribing}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                      (!canRun || lfm.isTranscribing) && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                      background: recorder.isRecording ? "var(--recording)" : "var(--accent)",
                      color: "#FFFFFF",
                    }}
                  >
                    <Mic className="w-4 h-4" />
                    {recorder.isRecording ? "Stop Recording" : "Record & Transcribe"}
                  </button>

                  <label
                    className="flex-1 px-4 py-3 rounded-xl text-sm text-center cursor-pointer"
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Upload Audio
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleAsrUpload}
                      disabled={!canRun || lfm.isTranscribing}
                    />
                  </label>
                </div>

                <AudioVisualizer analyserNode={recorder.analyserNode} isRecording={recorder.isRecording} />

                <div
                  className="mt-4 rounded-xl p-3 text-sm min-h-[120px]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--foreground)",
                  }}
                >
                  {lfm.isTranscribing ? "Transcribing..." : lfm.asrText || "Transcript will appear here."}
                </div>
              </section>
            )}

            {mode === "tts" && (
              <section className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
                <h3
                  className="text-sm font-semibold mb-4"
                  style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
                >
                  Text to Speech
                </h3>

                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition-colors mb-4"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--foreground)",
                  }}
                />

                <button
                  onClick={() => lfm.synthesize(ttsText)}
                  disabled={!canRun || lfm.isSynthesizing || !ttsText.trim()}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all mb-4",
                    (!canRun || lfm.isSynthesizing || !ttsText.trim()) &&
                      "opacity-50 cursor-not-allowed"
                  )}
                  style={{
                    background: "var(--accent)",
                    color: "#FFFFFF",
                  }}
                >
                  <Speech className="w-4 h-4" />
                  {lfm.isSynthesizing ? "Synthesizing..." : "Generate Speech"}
                </button>

                {ttsUrl && lfm.ttsAudio && (
                  <div className="space-y-3">
                    <AudioPlayer audioUrl={ttsUrl} filename="lfm-tts.wav" />
                    {lfm.ttsTextOutput && (
                      <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                        Model text output: {lfm.ttsTextOutput}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {mode === "interleaved" && (
              <section className="card p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
                <h3
                  className="text-sm font-semibold mb-4"
                  style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
                >
                  Continuous Interleaved Voice
                </h3>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={lfm.startContinuousSession}
                    disabled={!canRun || lfm.isSessionActive}
                    className={clsx(
                      "px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                      (!canRun || lfm.isSessionActive) && "opacity-50 cursor-not-allowed"
                    )}
                    style={{ background: "var(--accent)", color: "#FFFFFF" }}
                  >
                    Start Session
                  </button>
                  <button
                    onClick={lfm.stopContinuousSession}
                    disabled={!lfm.isSessionActive}
                    className={clsx(
                      "px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                      !lfm.isSessionActive && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Stop Session
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={lfm.resetInterleavedConversation}
                    disabled={!lfm.isSessionActive}
                    className={clsx(
                      "px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                      !lfm.isSessionActive && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Reset Conversation
                  </button>
                  <button
                    onClick={lfm.clearTurns}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: "var(--surface)",
                      color: "var(--muted)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Clear Log
                  </button>
                </div>

                <AudioVisualizer
                  analyserNode={lfm.analyserNode}
                  isRecording={lfm.isSessionActive}
                />

                <p className="text-xs mt-3" style={{ color: "var(--muted-light)" }}>
                  {lfm.isSessionActive
                    ? lfm.isSessionProcessing
                      ? "Processing current turn..."
                      : "Listening continuously. Speak naturally; silence ends the turn."
                    : "Start session to begin near-real-time turn-taking."}
                </p>

                {lfm.liveInterleavedText && (
                  <div
                    className="mt-3 rounded-xl p-3 text-xs"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--muted)",
                    }}
                  >
                    Live response: {lfm.liveInterleavedText}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {lfm.turns.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                      Conversation turns will appear here.
                    </p>
                  )}

                  {lfm.turns.map((turn) => (
                    <div
                      key={turn.id}
                      className="rounded-xl p-3"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <p className="text-[11px] mb-1" style={{ color: "var(--muted-light)" }}>
                        You
                      </p>
                      <p className="text-sm mb-2" style={{ color: "var(--foreground)" }}>
                        {turn.transcript || "(No transcript)"}
                      </p>

                      <p className="text-[11px] mb-1" style={{ color: "var(--muted-light)" }}>
                        Assistant
                      </p>
                      <p className="text-sm mb-3" style={{ color: "var(--foreground)" }}>
                        {turn.responseText || "(No text response)"}
                      </p>

                      {turn.audioUrl && (
                        <AudioPlayer audioUrl={turn.audioUrl} filename={`lfm-turn-${turn.id}.wav`} />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <footer className="mt-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
            <span>Powered by</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>
              onnxruntime-web
            </span>
            <span>&</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>
              LFM2.5 Audio
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
