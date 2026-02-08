"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Waves,
  Radio,
  MessageSquare,
  Scissors,
  ScanSearch,
  Atom,
  Eye,
  Mountain,
  Speech,
  Music,
  Search,
  Shapes,
  Languages,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

type FeatureStatus = "beta" | "wip";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  status?: FeatureStatus;
}

interface NavCategory {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    label: "Speech & Audio",
    icon: Waves,
    items: [
      { href: "/speech-to-text", label: "Speech to Text", icon: Waves },
      { href: "/text-to-speech", label: "Text to Speech", icon: Speech, status: "beta" },
      { href: "/lfm-audio", label: "LFM Audio", icon: Radio, status: "beta" },
      { href: "/music-generation", label: "Music Generation", icon: Music, status: "wip" },
    ],
  },
  {
    label: "Vision & Image",
    icon: Eye,
    items: [
      { href: "/background-removal", label: "Background Removal", icon: Scissors },
      { href: "/object-detection", label: "Object Detection", icon: ScanSearch },
      { href: "/depth-estimation", label: "Depth Estimation", icon: Mountain, status: "wip" },
      { href: "/image-segmentation", label: "Image Segmentation", icon: Shapes, status: "beta" },
      { href: "/vision-chat", label: "Vision Chat", icon: Eye, status: "beta" },
    ],
  },
  {
    label: "Text & Language",
    icon: MessageSquare,
    items: [
      { href: "/chat", label: "Chat", icon: MessageSquare },
      { href: "/translation", label: "Translation", icon: Languages, status: "beta" },
      { href: "/semantic-search", label: "Semantic Search", icon: Search, status: "beta" },
    ],
  },
  {
    label: "GPU Compute",
    icon: Atom,
    items: [
      { href: "/particle-simulator", label: "Particle Simulator", icon: Atom, status: "beta" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(NAV_CATEGORIES.map((c) => c.label))
  );

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile header bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4"
        style={{
          background: "var(--card)",
          borderBottom: "1px solid var(--card-border)",
        }}
      >
        <Link
          href="/"
          className="text-base font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          WebGPU.Studio
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--muted)" }}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "260px",
          background: "var(--card)",
          borderRight: "1px solid var(--card-border)",
        }}
      >
        {/* Accent bar */}
        <div
          className="h-1 w-full shrink-0"
          style={{
            background:
              "linear-gradient(90deg, var(--accent) 0%, var(--warning) 50%, var(--accent-light) 100%)",
          }}
        />

        {/* Logo */}
        <div className="px-5 py-4 shrink-0">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            onClick={() => setIsOpen(false)}
          >
            WebGPU.Studio
          </Link>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-light)" }}>
            In-Browser AI Playground
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
          {NAV_CATEGORIES.map((category) => {
            const isExpanded = expandedCategories.has(category.label);
            const CategoryIcon = category.icon;
            const hasActiveChild = category.items.some((item) => isActive(item.href));

            return (
              <div key={category.label} className="mb-1">
                <button
                  onClick={() => toggleCategory(category.label)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    color: hasActiveChild ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  <CategoryIcon className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left">{category.label}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-2 space-y-0.5 mt-0.5">
                    {category.items.map(({ href, label, icon: Icon, status }) => {
                      const active = isActive(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                          style={{
                            background: active ? "var(--accent-bg)" : "transparent",
                            color: active ? "var(--accent)" : "var(--foreground)",
                            border: active
                              ? "1px solid var(--accent-border)"
                              : "1px solid transparent",
                            fontWeight: active ? 500 : 400,
                          }}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate flex-1">{label}</span>
                          {status === "beta" && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{
                                background: "var(--warning-bg, rgba(234, 179, 8, 0.1))",
                                color: "var(--warning, #b8860b)",
                              }}
                            >
                              BETA
                            </span>
                          )}
                          {status === "wip" && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{
                                background: "var(--error-bg)",
                                color: "var(--error)",
                              }}
                            >
                              WIP
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-3 shrink-0 border-t"
          style={{ borderColor: "var(--card-border)" }}
        >
          <p className="text-[10px]" style={{ color: "var(--muted-light)" }}>
            All processing runs locally
          </p>
        </div>
      </aside>
    </>
  );
}
