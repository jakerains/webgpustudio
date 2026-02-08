"use client";

import { clsx } from "clsx";

type Status = "idle" | "loading" | "ready" | "recording" | "transcribing" | "error";

interface StatusIndicatorProps {
  status: Status;
  label?: string;
}

const statusConfig: Record<Status, { color: string; pulseColor: string; defaultLabel: string }> = {
  idle: { color: "bg-gray-400", pulseColor: "", defaultLabel: "Idle" },
  loading: { color: "bg-violet-400", pulseColor: "animate-pulse", defaultLabel: "Loading..." },
  ready: { color: "bg-emerald-400", pulseColor: "", defaultLabel: "Ready" },
  recording: { color: "bg-rose-400", pulseColor: "animate-pulse", defaultLabel: "Recording" },
  transcribing: { color: "bg-amber-400", pulseColor: "animate-pulse", defaultLabel: "Transcribing..." },
  error: { color: "bg-red-400", pulseColor: "", defaultLabel: "Error" },
};

export function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
      <span className="relative flex h-2 w-2">
        {config.pulseColor && (
          <span
            className={clsx(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              config.color,
              config.pulseColor
            )}
          />
        )}
        <span className={clsx("relative inline-flex rounded-full h-2 w-2", config.color)} />
      </span>
      <span className="text-xs font-medium text-gray-300">
        {label || config.defaultLabel}
      </span>
    </div>
  );
}
