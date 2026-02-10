"use client";

import { AudioLines, Settings, Download, AlertCircle, ChevronDown, HardDrive } from "lucide-react";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { useAudioIntelligence } from "@/hooks/useAudioIntelligence";
import { AUDIO_INTELLIGENCE_MODELS } from "@/lib/audio-intelligence-constants";
import { AudioInputArea } from "@/components/audio-intelligence/AudioInputArea";
import { AudioEmptyState } from "@/components/audio-intelligence/AudioEmptyState";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { ChatInput } from "@/components/chat/ChatInput";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusIndicator } from "@/components/StatusIndicator";

export default function AudioIntelligencePage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const ai = useAudioIntelligence();

  const selectedModel =
    AUDIO_INTELLIGENCE_MODELS.find((m) => m.id === ai.modelId) ??
    AUDIO_INTELLIGENCE_MODELS[0];
  const isSelectedCached = ai.cachedModelIds.has(ai.modelId);

  return (
    <main className="min-h-screen flex flex-col">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14 w-full">
        {/* Zone A: Header */}
        <header className="text-center mb-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="p-2.5 rounded-xl animate-float"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <AudioLines className="w-7 h-7" style={{ color: "var(--accent)" }} />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Audio Intelligence
            </h1>
          </div>
          <p
            className="text-sm mb-4 max-w-md mx-auto leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Transcribe, summarize, and ask questions about audio — powered by
            Voxtral running locally via WebGPU
          </p>
          <div className="flex items-center justify-center gap-2">
            {isCheckingWebGPU ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "var(--surface)",
                  color: "var(--muted)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--muted-light)" }}
                />
                Checking WebGPU...
              </span>
            ) : isWebGPUSupported ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "var(--success-bg)",
                  color: "var(--success)",
                  border: "1px solid var(--success-border)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--success)" }}
                />
                WebGPU Available
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "var(--error-bg)",
                  color: "var(--error)",
                  border: "1px solid var(--error-border)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--error)" }}
                />
                WebGPU Required
              </span>
            )}
          </div>
        </header>

        {/* Zone A: Model Setup */}
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
                Audio Model
              </h2>
            </div>
            <StatusIndicator
              status={
                ai.isModelReady
                  ? "ready"
                  : ai.isModelLoading
                    ? "loading"
                    : ai.modelError
                      ? "error"
                      : "idle"
              }
            />
          </div>

          {!ai.isModelReady && (
            <>
              {/* Model selector */}
              <div className="mb-5">
                <label
                  className="text-xs font-medium mb-2 block"
                  style={{ color: "var(--muted)" }}
                >
                  Model
                </label>
                <div className="relative">
                  <select
                    value={ai.modelId}
                    onChange={(e) => ai.setModelId(e.target.value)}
                    disabled={ai.isModelLoading}
                    className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-medium transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {AUDIO_INTELLIGENCE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label} — {model.size}
                        {ai.cachedModelIds.has(model.id) ? " \u2713 Cached" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "var(--muted-light)" }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <p
                    className="text-xs"
                    style={{ color: "var(--muted-light)" }}
                  >
                    {selectedModel.description}
                  </p>
                  {isSelectedCached && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0"
                      style={{
                        background: "var(--success-bg)",
                        color: "var(--success)",
                        border: "1px solid var(--success-border)",
                      }}
                    >
                      <HardDrive className="w-2.5 h-2.5" />
                      Cached
                    </span>
                  )}
                </div>
              </div>

              {/* Load button */}
              <button
                onClick={ai.loadModel}
                disabled={ai.isModelLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-wait"
                style={{
                  background: ai.isModelLoading
                    ? "var(--accent-bg)"
                    : isSelectedCached
                      ? "var(--success)"
                      : "var(--accent)",
                  color: ai.isModelLoading ? "var(--accent)" : "#FFFFFF",
                  border: ai.isModelLoading
                    ? "1px solid var(--accent-border)"
                    : "none",
                  boxShadow: ai.isModelLoading
                    ? "none"
                    : isSelectedCached
                      ? "0 2px 12px rgba(90, 154, 110, 0.3)"
                      : "0 2px 12px rgba(194, 114, 78, 0.3)",
                }}
              >
                {ai.isModelLoading ? (
                  <>
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: "var(--accent-border)",
                        borderTopColor: "var(--accent)",
                      }}
                    />
                    {isSelectedCached ? "Loading from Cache..." : "Downloading Model..."}
                  </>
                ) : isSelectedCached ? (
                  <>
                    <HardDrive className="w-4 h-4" />
                    Load from Cache
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Model ({selectedModel.size})
                  </>
                )}
              </button>

              <ProgressBar items={ai.progressItems} />

              {ai.modelError && (
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
                    {ai.modelError}
                  </p>
                </div>
              )}
            </>
          )}

          {ai.isModelReady && (
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--success)" }}
              />
              <div className="flex-1">
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

        {/* Zone B: Audio Input */}
        {ai.isModelReady && (
          <div
            className="card p-6 mb-6 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <h2
              className="text-base font-semibold mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Audio Input
            </h2>
            <AudioInputArea
              audioUrl={ai.audioUrl}
              onFileSelect={ai.setAudioFromFile}
              onRecordingComplete={ai.setAudioFromRecording}
              onClear={ai.clearAudio}
            />
          </div>
        )}
      </div>

      {/* Zone C: Conversation */}
      {ai.isModelReady && ai.hasAudio && (
        <div
          className="flex-1 flex flex-col max-w-2xl mx-auto w-full card overflow-hidden animate-fade-in-up"
          style={{ maxHeight: "calc(100vh - 120px)", minHeight: "400px" }}
        >
          {ai.messages.length === 0 && !ai.isGenerating ? (
            <AudioEmptyState onSuggestionClick={ai.sendMessage} />
          ) : (
            <ChatConversation
              messages={ai.messages}
              streamingContent={ai.streamingContent}
              streamingThinking=""
              isGenerating={ai.isGenerating}
              isThinking={false}
            />
          )}

          {/* Generation error */}
          {ai.generationError && (
            <div
              className="mx-4 mb-2 flex items-start gap-2 p-3 rounded-xl"
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
                {ai.generationError}
              </p>
            </div>
          )}

          <ChatInput
            input={ai.input}
            onInputChange={ai.setInput}
            onSubmit={ai.handleSubmit}
            onStop={ai.stop}
            onClear={() => ai.setMessages([])}
            isGenerating={ai.isGenerating}
            disabled={!ai.isModelReady || !ai.hasAudio}
            hasMessages={ai.messages.length > 0}
          />
        </div>
      )}

      {ai.isModelReady && ai.hasAudio && (
        <footer className="mt-6 pb-6 text-center">
          <div
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: "var(--muted)" }}
          >
            <span>Running locally</span>
            <span style={{ color: "var(--muted-light)" }}>&middot;</span>
            <span>
              Powered by{" "}
              <span
                className="font-medium"
                style={{ color: "var(--foreground)" }}
              >
                Voxtral
              </span>
            </span>
          </div>
        </footer>
      )}
    </main>
  );
}
