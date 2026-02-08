"use client";

interface VoiceSelectorProps {
  modelLabel: string;
  voiceProfile?: string;
  supportsInterleaved?: boolean;
}

export function VoiceSelector({
  modelLabel,
  voiceProfile,
  supportsInterleaved = false,
}: VoiceSelectorProps) {
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
