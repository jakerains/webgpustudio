"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";

interface FeatureCardProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  modelSize?: string;
  isNew?: boolean;
}

export function FeatureCard({
  href,
  title,
  description,
  icon: Icon,
  modelSize,
  isNew,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group card p-4 flex flex-col gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
          style={{
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <Icon
            className="w-5 h-5 transition-transform group-hover:scale-110"
            style={{ color: "var(--accent)" }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {isNew && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--success-bg)",
                color: "var(--success)",
                border: "1px solid var(--success-border)",
              }}
            >
              NEW
            </span>
          )}
          {modelSize && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--surface)",
                color: "var(--muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {modelSize}
            </span>
          )}
        </div>
      </div>

      <div>
        <h3
          className="text-sm font-semibold mb-0.5"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          {description}
        </p>
      </div>
    </Link>
  );
}
