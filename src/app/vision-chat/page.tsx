"use client";

import { Eye } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusIndicator } from "@/components/StatusIndicator";
import { ImageUploadZone } from "@/components/vision/ImageUploadZone";
import { VisionConversation } from "@/components/vision/VisionConversation";
import { ChatInput } from "@/components/chat/ChatInput";
import { useVisionChat } from "@/hooks/useVisionChat";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import {
  VISION_CHAT_MODELS,
  VISION_SUGGESTIONS,
} from "@/lib/vision-chat-constants";
import {
  Settings,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  HardDrive,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";

export default function VisionChatPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const vision = useVisionChat();

  const selectedModel =
    VISION_CHAT_MODELS.find((m) => m.id === vision.modelId) ??
    VISION_CHAT_MODELS[0];
  const isSelectedCached = vision.cachedModelIds.has(vision.modelId);

  const handleSuggestionClick = (text: string) => {
    vision.setInput(text);
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14 w-full">
        {/* Header */}
        <header className="text-center mb-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="p-2.5 rounded-xl animate-float"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <Eye className="w-7 h-7" style={{ color: "var(--accent)" }} />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
              }}
            >
              Vision Chat
            </h1>
          </div>
          <p
            className="text-sm mb-4 max-w-md mx-auto leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Upload an image and chat about it using a vision-language model
            running entirely in your browser
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
                Vision Model
              </h2>
            </div>
            <StatusIndicator
              status={
                vision.isModelReady
                  ? "ready"
                  : vision.isModelLoading
                    ? "loading"
                    : vision.modelError
                      ? "error"
                      : "idle"
              }
            />
          </div>

          {!vision.isModelReady && (
            <>
              {/* Model Selector */}
              <div className="mb-5">
                <label
                  className="text-xs font-medium mb-2 block"
                  style={{ color: "var(--muted)" }}
                >
                  Model
                </label>
                <div className="relative">
                  <select
                    value={vision.modelId}
                    onChange={(e) => vision.setModelId(e.target.value)}
                    disabled={vision.isModelLoading}
                    className={clsx(
                      "w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-medium transition-all focus:outline-none",
                      vision.isModelLoading && "opacity-40 cursor-not-allowed"
                    )}
                    style={{
                      background: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {VISION_CHAT_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label} — {model.size}
                        {vision.cachedModelIds.has(model.id) ? " Cached" : ""}
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

              {/* Load Button */}
              <button
                onClick={vision.loadModel}
                disabled={vision.isModelLoading}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  vision.isModelLoading
                    ? "cursor-wait"
                    : "hover:brightness-110 active:scale-[0.99]"
                )}
                style={{
                  background: vision.isModelLoading
                    ? "var(--accent-bg)"
                    : isSelectedCached
                      ? "var(--success)"
                      : "var(--accent)",
                  color: vision.isModelLoading ? "var(--accent)" : "#FFFFFF",
                  border: vision.isModelLoading
                    ? "1px solid var(--accent-border)"
                    : "none",
                  boxShadow: vision.isModelLoading
                    ? "none"
                    : isSelectedCached
                      ? "0 2px 12px rgba(90, 154, 110, 0.3)"
                      : "0 2px 12px rgba(194, 114, 78, 0.3)",
                }}
              >
                {vision.isModelLoading ? (
                  <>
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{
                        borderColor: "var(--accent-border)",
                        borderTopColor: "var(--accent)",
                      }}
                    />
                    {isSelectedCached
                      ? "Loading from Cache..."
                      : "Downloading Model..."}
                  </>
                ) : isSelectedCached ? (
                  <>
                    <HardDrive className="w-4 h-4" />
                    Load from Cache
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Model
                  </>
                )}
              </button>

              {/* Progress */}
              <ProgressBar items={vision.progressItems} />

              {/* Error */}
              {vision.modelError && (
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
                    {vision.modelError}
                  </p>
                </div>
              )}
            </>
          )}

          {vision.isModelReady && (
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
      </div>

      {/* Vision Chat Interface */}
      {vision.isModelReady && (
        <div
          className="flex-1 flex flex-col max-w-2xl mx-auto w-full card overflow-hidden"
          style={{ maxHeight: "calc(100vh - 120px)", minHeight: "400px" }}
        >
          {/* Image Upload Area */}
          <div
            className="p-4 border-b"
            style={{ borderColor: "var(--card-border)" }}
          >
            <ImageUploadZone
              imageUrl={vision.imageUrl}
              onImageChange={(url) => {
                vision.setImageUrl(url);
                // Reset conversation when image changes
                if (url !== vision.imageUrl) {
                  vision.setMessages([]);
                }
              }}
            />
          </div>

          {/* Chat Area */}
          {!vision.imageUrl ? (
            // Prompt to upload
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <Eye
                    className="w-7 h-7"
                    style={{ color: "var(--muted-light)" }}
                  />
                </div>
                <h3
                  className="text-lg font-semibold mb-1"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--foreground)",
                  }}
                >
                  Upload an image to start
                </h3>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Drop an image above, then ask questions about it
                </p>
              </div>
            </div>
          ) : vision.messages.length === 0 && !vision.isGenerating ? (
            // Empty state with suggestions
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
                  style={{
                    background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  <Sparkles
                    className="w-7 h-7"
                    style={{ color: "var(--accent)" }}
                  />
                </div>
                <h3
                  className="text-lg font-semibold mb-1"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--foreground)",
                  }}
                >
                  Image loaded
                </h3>
                <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
                  Ask a question about the image, or try a suggestion
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {VISION_SUGGESTIONS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSuggestionClick(chip)}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:brightness-95 active:scale-[0.98]"
                      style={{
                        background: "var(--surface)",
                        color: "var(--muted)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Conversation
            <VisionConversation
              messages={vision.messages}
              streamingContent={vision.streamingContent}
              isGenerating={vision.isGenerating}
            />
          )}

          <ChatInput
            input={vision.input}
            onInputChange={vision.setInput}
            onSubmit={vision.handleSubmit}
            onStop={vision.stop}
            isGenerating={vision.isGenerating}
            disabled={!vision.isModelReady || !vision.imageUrl}
          />
        </div>
      )}

      {vision.isModelReady && (
        <footer className="mt-6 pb-6 text-center">
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
              SmolVLM
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--muted-light)" }}
          >
            All processing happens locally in your browser
          </p>
        </footer>
      )}
    </main>
  );
}
