"use client";

import { useRef, useEffect } from "react";
import { Send, Square, Trash2 } from "lucide-react";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onClear?: () => void;
  isGenerating: boolean;
  disabled: boolean;
  hasMessages?: boolean;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  onStop,
  onClear,
  isGenerating,
  disabled,
  hasMessages = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && input.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <div
      className="p-4 border-t"
      style={{
        borderColor: "var(--card-border)",
        background: "var(--card)",
      }}
    >
      <div
        className="flex items-end gap-2 rounded-xl p-2"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {hasMessages && !isGenerating && onClear && (
          <button
            onClick={onClear}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:brightness-110 active:scale-95"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
            }}
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" style={{ color: "var(--muted)" }} />
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed focus:outline-none px-2 py-1.5 placeholder:text-[var(--muted-light)]"
          style={{ color: "var(--foreground)", maxHeight: "150px" }}
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:brightness-110 active:scale-95"
            style={{
              background: "var(--error)",
              boxShadow: "0 2px 8px rgba(194, 84, 84, 0.3)",
            }}
            title="Stop generating"
          >
            <Square className="w-4 h-4 text-white" fill="white" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!input.trim() || disabled}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              boxShadow:
                input.trim() && !disabled
                  ? "0 2px 8px rgba(194, 114, 78, 0.3)"
                  : "none",
            }}
            title="Send message"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
      <p
        className="text-[10px] mt-2 text-center"
        style={{ color: "var(--muted-light)" }}
      >
        Running locally in your browser · Shift+Enter for new line
      </p>
    </div>
  );
}
