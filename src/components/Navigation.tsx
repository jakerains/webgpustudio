"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Waves, MessageSquare, ImageMinus, Layers, Sparkles, Volume2, Music, Search, Scissors, Languages, Radio } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Speech to Text", icon: Waves },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/text-to-speech", label: "TTS", icon: Volume2 },
  { href: "/lfm-audio", label: "LFM", icon: Radio },
  { href: "/music-generation", label: "Music", icon: Music },
  { href: "/background-removal", label: "BG Removal", icon: ImageMinus },
  { href: "/depth-estimation", label: "Depth", icon: Layers },
  { href: "/particle-simulator", label: "Particles", icon: Sparkles },
  { href: "/semantic-search", label: "Search", icon: Search },
  { href: "/image-segmentation", label: "Segment", icon: Scissors },
  { href: "/translation", label: "Translate", icon: Languages },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav>
      {/* Warm top accent bar */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--accent) 0%, var(--warning) 50%, var(--accent-light) 100%)",
        }}
      />

      <div
        className="border-b"
        style={{
          background: "var(--card)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="max-w-4xl mx-auto px-5 flex items-center justify-between h-14">
          <span
            className="text-base font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--foreground)",
            }}
          >
            WebGPU Studio
          </span>

          <div className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: isActive ? "var(--accent-bg)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--muted)",
                    border: isActive
                      ? "1px solid var(--accent-border)"
                      : "1px solid transparent",
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
