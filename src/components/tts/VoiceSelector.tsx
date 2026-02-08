"use client";

import { ChevronDown } from "lucide-react";

interface Speaker {
  id: string;
  label: string;
}

interface VoiceSelectorProps {
  modelLabel: string;
  voiceProfile?: string;
  supportsInterleaved?: boolean;
  speakers?: readonly Speaker[];
  selectedSpeaker?: string;
  onSpeakerChange?: (id: string) => void;
}

export function VoiceSelector({
  modelLabel,
  voiceProfile,
  supportsInterleaved = false,
  speakers,
  selectedSpeaker,
  onSpeakerChange,
}: VoiceSelectorProps) {
  // Interactive mode: render a dropdown when speakers are provided
  if (speakers && onSpeakerChange) {
    return (
      <div>
        <label
          className="text-xs font-medium mb-2 block"
          style={{ color: "var(--muted)" }}
        >
          Speaker Voice
        </label>
        <div className="relative">
          <select
            value={selectedSpeaker}
            onChange={(e) => onSpeakerChange(e.target.value)}
            className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl text-sm font-medium transition-all focus:outline-none"
            style={{
              background: "var(--surface)",
              color: "var(--foreground)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {speakers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--muted-light)" }}
          />
        </div>
      </div>
    );
  }

  // Read-only mode: static display for models without speaker selection
  return (
    <div
      className="rounded-xl p-3 text-xs"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        color: "var(--muted)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--accent)" }}
        />
        <span>
          {modelLabel} voice profile: {voiceProfile ?? "Default"}.
          {supportsInterleaved
            ? " This model also supports ASR and interleaved voice turns in the new LFM Audio demo."
            : ""}
        </span>
      </div>
    </div>
  );
}
