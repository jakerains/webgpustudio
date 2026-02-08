"use client";

import { useEffect, useCallback } from "react";
import { X, Plus, Zap, Wrench, RefreshCw } from "lucide-react";
import { APP_VERSION, CHANGELOG, type ChangelogEntry } from "@/lib/version";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_CONFIG = {
  added: {
    icon: Plus,
    label: "Added",
    color: "var(--success)",
    bg: "var(--success-bg)",
    border: "var(--success-border)",
  },
  improved: {
    icon: Zap,
    label: "Improved",
    color: "var(--accent)",
    bg: "var(--accent-bg)",
    border: "var(--accent-border)",
  },
  fixed: {
    icon: Wrench,
    label: "Fixed",
    color: "var(--warning)",
    bg: "var(--warning-bg)",
    border: "var(--warning-border)",
  },
  changed: {
    icon: RefreshCw,
    label: "Changed",
    color: "var(--muted)",
    bg: "var(--surface)",
    border: "var(--border-subtle)",
  },
};

function VersionEntry({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) {
  return (
    <div
      className="relative pl-6 pb-8 last:pb-0"
      style={{ borderLeft: `2px solid ${isLatest ? "var(--accent)" : "var(--border-subtle)"}` }}
    >
      {/* Timeline dot */}
      <div
        className="absolute -left-[7px] top-0 w-3 h-3 rounded-full"
        style={{
          background: isLatest
            ? "linear-gradient(135deg, var(--accent), var(--accent-light))"
            : "var(--border-subtle)",
          boxShadow: isLatest ? "0 0 8px rgba(194, 114, 78, 0.4)" : "none",
        }}
      />

      {/* Version header */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span
          className="text-sm font-bold tracking-tight"
          style={{
            fontFamily: "var(--font-display)",
            color: isLatest ? "var(--accent)" : "var(--foreground)",
          }}
        >
          v{entry.version}
        </span>
        {isLatest && (
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--accent-bg)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
            }}
          >
            Latest
          </span>
        )}
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{
            fontFamily: "var(--font-mono)",
            background: "var(--surface)",
            color: "var(--muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {entry.date}
        </span>
      </div>

      {/* Release title */}
      <h3
        className="text-xs font-medium mb-3"
        style={{ color: "var(--muted)" }}
      >
        {entry.title}
      </h3>

      {/* Changes list */}
      <div className="flex flex-col gap-1.5">
        {entry.changes.map((change, i) => {
          const config = TYPE_CONFIG[change.type];
          const Icon = config.icon;
          return (
            <div key={i} className="flex items-start gap-2">
              <div
                className="flex items-center gap-1 shrink-0 mt-px px-1.5 py-0.5 rounded"
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                }}
              >
                <Icon className="w-2.5 h-2.5" style={{ color: config.color }} />
                <span
                  className="text-[9px] font-semibold uppercase tracking-wide"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
              </div>
              <span className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>
                {change.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in-up"
        style={{
          background: "rgba(45, 36, 24, 0.4)",
          backdropFilter: "blur(8px)",
          animationDuration: "0.2s",
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl animate-fade-in-up overflow-hidden"
        style={{
          background: "var(--card)",
          border: "1px solid var(--card-border)",
          boxShadow:
            "0 8px 48px rgba(139, 109, 75, 0.15), 0 2px 8px rgba(139, 109, 75, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          animationDuration: "0.3s",
          animationDelay: "0.05s",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background: "linear-gradient(180deg, rgba(251, 240, 233, 0.5), transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-light))",
                boxShadow: "0 2px 8px rgba(194, 114, 78, 0.3)",
              }}
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2
                className="text-base font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >
                Changelog
              </h2>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                WebGPU Studio v{APP_VERSION}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:brightness-95"
            style={{
              background: "var(--surface)",
              color: "var(--muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 scrollbar-thin">
          {CHANGELOG.map((entry, i) => (
            <VersionEntry key={entry.version} entry={entry} isLatest={i === 0} />
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 shrink-0 text-center"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--surface)",
          }}
        >
          <p className="text-[10px]" style={{ color: "var(--muted-light)" }}>
            All processing happens locally — no data leaves your device
          </p>
        </div>
      </div>
    </div>
  );
}
