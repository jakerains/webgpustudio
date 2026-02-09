"use client";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatModelSetup } from "@/components/chat/ChatModelSetup";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { ChatInput } from "@/components/chat/ChatInput";
import { useChatBot } from "@/hooks/useChatBot";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { CHAT_MODELS } from "@/lib/chat-constants";

export default function ChatPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const chat = useChatBot();

  const selectedModel =
    CHAT_MODELS.find((m) => m.id === chat.modelId) ?? CHAT_MODELS[0];

  const handleSuggestionClick = (text: string) => {
    chat.setInput(text);
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14 w-full">
        <ChatHeader
          isWebGPUSupported={isWebGPUSupported}
          isCheckingWebGPU={isCheckingWebGPU}
        />

        <ChatModelSetup
          isModelLoading={chat.isModelLoading}
          isModelReady={chat.isModelReady}
          progressItems={chat.progressItems}
          error={chat.modelError}
          modelId={chat.modelId}
          cachedModelIds={chat.cachedModelIds}
          onModelChange={chat.setModelId}
          onLoadModel={chat.loadModel}
        />
      </div>

      {chat.isModelReady && (
        <div
          className="flex-1 flex flex-col max-w-2xl mx-auto w-full card overflow-hidden"
          style={{ maxHeight: "calc(100vh - 120px)", minHeight: "400px" }}
        >
          {chat.messages.length === 0 && !chat.isGenerating ? (
            <ChatEmptyState
              modelLabel={selectedModel.label}
              onSuggestionClick={handleSuggestionClick}
            />
          ) : (
            <ChatConversation
              messages={chat.messages}
              streamingContent={chat.streamingContent}
              streamingThinking={chat.streamingThinking}
              isGenerating={chat.isGenerating}
              isThinking={chat.isThinking}
            />
          )}

          <ChatInput
            input={chat.input}
            onInputChange={chat.setInput}
            onSubmit={chat.handleSubmit}
            onStop={chat.stop}
            onClear={() => chat.setMessages([])}
            isGenerating={chat.isGenerating}
            disabled={!chat.isModelReady}
            hasMessages={chat.messages.length > 0}
          />
        </div>
      )}

      {chat.isModelReady && (
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
      )}
    </main>
  );
}
