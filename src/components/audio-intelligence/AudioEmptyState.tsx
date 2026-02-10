"use client";

import { AudioLines } from "lucide-react";
import { AUDIO_INTELLIGENCE_SUGGESTIONS } from "@/lib/audio-intelligence-constants";

interface AudioEmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export function AudioEmptyState({ onSuggestionClick }: AudioEmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float"
          style={{
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <AudioLines className="w-7 h-7" style={{ color: "var(--accent)" }} />
        </div>
        <h3
          className="text-lg font-semibold mb-1"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--foreground)",
          }}
        >
          Audio loaded — ask anything
        </h3>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          Transcribe, summarize, or ask questions about your audio
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {AUDIO_INTELLIGENCE_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => onSuggestionClick(suggestion.prompt)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all hover:brightness-95 active:scale-[0.98]"
              style={{
                background: "var(--surface)",
                color: "var(--muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
