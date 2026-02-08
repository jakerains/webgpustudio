"use client";

export function VoiceSelector() {
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
          Using default SpeechT5 speaker voice. SpeechT5 synthesizes
          natural-sounding English speech from text input.
        </span>
      </div>
    </div>
  );
}
