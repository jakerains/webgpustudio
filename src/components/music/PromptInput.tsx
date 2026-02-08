"use client";

import { MUSIC_SUGGESTIONS } from "@/lib/music-constants";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PromptInput({ value, onChange, disabled }: PromptInputProps) {
  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the music you want to generate..."
        disabled={disabled}
        rows={3}
        className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition-colors"
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

      <div className="flex flex-wrap gap-2">
        {MUSIC_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onChange(suggestion)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-bg)";
              e.currentTarget.style.borderColor = "var(--accent-border)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
