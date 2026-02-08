"use client";

import type { TranscriberProgressItem } from "@/types/transcriber";

interface ProgressBarProps {
  items: TranscriberProgressItem[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function ProgressBar({ items }: ProgressBarProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      {items.map((item) => (
        <div
          key={item.file}
          className="rounded-lg bg-white/5 border border-white/10 p-3"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400 truncate max-w-[70%]">
              {item.file}
            </span>
            <span className="text-xs text-gray-500">
              {item.status === "done"
                ? "Done"
                : item.total > 0
                ? `${formatBytes(item.loaded)} / ${formatBytes(item.total)}`
                : `${Math.round(item.progress)}%`}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${Math.min(item.progress, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
