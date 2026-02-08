"use client";

import { Gpu } from "lucide-react";

const VARIANTS = [
  { name: "Square", varName: "--font-geist-pixel-square", description: "Classic bitmap — sharp square pixels" },
  { name: "Grid", varName: "--font-geist-pixel-grid", description: "Visible grid gaps between pixels" },
  { name: "Circle", varName: "--font-geist-pixel-circle", description: "Round dots instead of squares" },
  { name: "Triangle", varName: "--font-geist-pixel-triangle", description: "Triangular pixel shapes" },
  { name: "Line", varName: "--font-geist-pixel-line", description: "Thin line strokes forming the grid" },
];

export default function FontPreviewPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-5 py-10 sm:py-14">
        <div className="text-center mb-10">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--accent)" }}
          >
            Font Preview
          </p>
          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            Geist Pixel Variants
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Each variant shown in the hero style
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {VARIANTS.map((variant) => (
            <div
              key={variant.name}
              className="rounded-2xl p-8 sm:p-10 text-center"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                boxShadow: "var(--card-shadow)",
              }}
            >
              {/* Variant label */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  {variant.name}
                </span>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "var(--surface)",
                    color: "var(--muted)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {variant.varName}
                </span>
              </div>

              {/* Hero replica */}
              <div className="inline-flex items-center gap-2 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, var(--accent), var(--accent-light))",
                    boxShadow: "0 4px 16px rgba(194, 114, 78, 0.3)",
                  }}
                >
                  <Gpu className="w-6 h-6 text-white" />
                </div>
              </div>
              <h2
                className="text-4xl sm:text-5xl font-bold tracking-tight mb-2"
                style={{ fontFamily: `var(${variant.varName})`, color: "var(--foreground)" }}
              >
                Web<span className="font-extrabold" style={{ color: "var(--accent)" }}>GPU</span> Studio
              </h2>
              <p className="text-base mb-1" style={{ color: "var(--muted)" }}>
                AI models running entirely in your browser, powered by WebGPU
              </p>
              <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                {variant.description}
              </p>
            </div>
          ))}
        </div>

        <footer className="mt-8 text-center">
          <p className="text-xs" style={{ color: "var(--muted-light)" }}>
            Temporary preview page — delete when done
          </p>
        </footer>
      </div>
    </main>
  );
}
