"use client";

import { useState, useEffect } from "react";
import {
  Waves,
  MessageSquare,
  Scissors,
  ScanSearch,
  Atom,
  Eye,
  Mountain,
  Speech,
  Radio,
  Music,
  Search,
  Shapes,
  Languages,
  Gpu,
  Zap,
  Sparkles,
  ArrowRight,
  Github,
  Monitor,
} from "lucide-react";
import Link from "next/link";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { CategorySection } from "@/components/CategorySection";
import { FeatureCard } from "@/components/FeatureCard";
import { ChangelogModal } from "@/components/ChangelogModal";
import { APP_VERSION } from "@/lib/version";

export default function LandingPage() {
  const { isSupported, isChecking } = useWebGPUSupport();
  const [showChangelog, setShowChangelog] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-10 sm:py-14">
        {/* Hero */}
        <div className="text-center mb-12">
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
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-2"
            style={{ fontFamily: "var(--font-geist-pixel-square)", color: "var(--foreground)" }}
          >
            Web<span className="font-extrabold" style={{ color: "var(--accent)" }}>GPU</span>.Studio
          </h1>
          <p className="text-base mb-4" style={{ color: "var(--muted)" }}>
            AI models running entirely in your browser, powered by WebGPU
          </p>

          {/* WebGPU Status Badge */}
          {!isChecking && (
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: isSupported ? "var(--success-bg)" : "var(--error-bg)",
                color: isSupported ? "var(--success)" : "var(--error)",
                border: `1px solid ${isSupported ? "var(--success-border)" : "var(--error-border)"}`,
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              {isSupported ? "WebGPU Available" : "WebGPU Not Supported"}
            </div>
          )}
        </div>

        {/* Mobile notice */}
        {isMobile && (
          <div
            className="rounded-2xl p-8 text-center mb-10 animate-fade-in-up"
            style={{
              background: "linear-gradient(145deg, rgba(251, 240, 233, 0.8), rgba(254, 251, 246, 0.95))",
              border: "1px solid var(--accent-border)",
              boxShadow: "0 4px 24px rgba(194, 114, 78, 0.1)",
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <Monitor className="w-7 h-7" style={{ color: "var(--accent)" }} />
            </div>
            <h2
              className="text-lg font-bold mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Best on Desktop
            </h2>
            <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--muted)" }}>
              WebGPU Studio runs ML models directly in your browser using your GPU.
              For the best experience, visit us on a desktop or laptop with a modern browser.
            </p>
            <p className="text-xs" style={{ color: "var(--muted-light)" }}>
              Most experiments require significant GPU memory and processing power.
            </p>
          </div>
        )}

        {/* Featured Section */}
        {!isMobile && <section className="mb-12 -mx-5 px-5 relative">
          {/* Background glow */}
          <div
            className="absolute inset-0 -top-8 -bottom-8 rounded-3xl animate-featured-glow"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(194, 114, 78, 0.08), transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Section container */}
          <div
            className="relative rounded-2xl p-6 sm:p-8 animate-fade-in-up"
            style={{
              background: "linear-gradient(145deg, rgba(251, 240, 233, 0.7), rgba(254, 251, 246, 0.9))",
              border: "1px solid var(--accent-border)",
              boxShadow: "0 4px 32px rgba(194, 114, 78, 0.08), 0 1px 4px rgba(194, 114, 78, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
            }}
          >
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center animate-gradient-shift"
                  style={{
                    background: "linear-gradient(135deg, var(--accent), var(--accent-light), var(--accent))",
                    boxShadow: "0 2px 8px rgba(194, 114, 78, 0.3)",
                  }}
                >
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2
                    className="text-base sm:text-lg font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
                  >
                    Try These First
                  </h2>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Our most polished experiences, ready to go
                  </p>
                </div>
              </div>
              <div
                className="hidden sm:flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <Sparkles className="w-2.5 h-2.5" />
                Featured
              </div>
            </div>

            {/* Featured cards — larger, more prominent */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  href: "/speech-to-text",
                  title: "Speech to Text",
                  description: "Real-time transcription powered by OpenAI Whisper. Record from your mic or upload audio files.",
                  icon: Waves,
                  modelSize: "39-244 MB",
                  tag: "Audio AI",
                },
                {
                  href: "/chat",
                  title: "Chat",
                  description: "Conversational AI with streaming responses and thinking support. Runs local LLMs directly in your browser.",
                  icon: MessageSquare,
                  modelSize: "570 MB-2.1 GB",
                  tag: "Text AI",
                },
                {
                  href: "/object-detection",
                  title: "Object Detection",
                  description: "Point your camera or upload a photo to detect and label objects in real-time with bounding boxes.",
                  icon: ScanSearch,
                  modelSize: "29-166 MB",
                  tag: "Vision AI",
                },
              ].map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="featured-card group relative rounded-xl p-5 flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up"
                  style={{
                    animationDelay: `${0.1 + i * 0.08}s`,
                    background: "var(--card)",
                    boxShadow: "0 2px 12px rgba(139, 109, 75, 0.06), 0 8px 32px rgba(139, 109, 75, 0.04)",
                    minHeight: "180px",
                  }}
                >
                  {/* Top row: icon + tag */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-[-3deg]"
                      style={{
                        background: "linear-gradient(135deg, var(--accent), var(--accent-light))",
                        boxShadow: "0 4px 12px rgba(194, 114, 78, 0.25)",
                      }}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span
                      className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--surface)",
                        color: "var(--accent)",
                        border: "1px solid var(--accent-border)",
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-end">
                    <h3
                      className="text-base font-bold mb-1 tracking-tight"
                      style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--muted)" }}>
                      {item.description}
                    </p>

                    {/* Bottom row: model size + arrow */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--surface)",
                          color: "var(--muted)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {item.modelSize}
                      </span>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all group-hover:translate-x-0.5"
                        style={{
                          background: "var(--accent-bg)",
                          border: "1px solid var(--accent-border)",
                        }}
                      >
                        <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>}

        {!isMobile && <>
        {/* All Features by Category */}
        <CategorySection title="Speech & Audio" icon={Waves}>
          <FeatureCard
            href="/speech-to-text"
            title="Speech to Text"
            description="Record or upload audio for real-time transcription with Whisper"
            icon={Waves}
            modelSize="39-244 MB"
          />
          <FeatureCard
            href="/text-to-speech"
            title="Text to Speech"
            description="Convert text to natural-sounding speech with LFM2.5 Audio or SpeechT5"
            icon={Speech}
            modelSize="150 MB-1.5 GB"
            status="experimental"
          />
          <FeatureCard
            href="/lfm-audio"
            title="LFM Audio Studio"
            description="Unified ASR, TTS, and near-real-time interleaved voice conversation"
            icon={Radio}
            modelSize="~1.5 GB"
            status="experimental"
          />
          <FeatureCard
            href="/music-generation"
            title="Music Generation"
            description="Generate music from text prompts with Meta's MusicGen"
            icon={Music}
            modelSize="~1.5 GB"
            status="broken"
          />
        </CategorySection>

        <CategorySection title="Vision & Image" icon={Eye}>
          <FeatureCard
            href="/background-removal"
            title="Background Removal"
            description="Instantly remove image backgrounds with RMBG"
            icon={Scissors}
            modelSize="44-200 MB"
          />
          <FeatureCard
            href="/object-detection"
            title="Object Detection"
            description="Real-time object detection with bounding boxes and labels"
            icon={ScanSearch}
            modelSize="29-166 MB"
          />
          <FeatureCard
            href="/depth-estimation"
            title="Depth Estimation"
            description="Generate depth maps from 2D images with Depth Anything V2"
            icon={Mountain}
            modelSize="~97 MB"
            status="broken"
          />
          <FeatureCard
            href="/image-segmentation"
            title="Image Segmentation"
            description="Click to segment objects with Meta's SAM3 — upload or use your camera"
            icon={Shapes}
            modelSize="~301 MB"
            status="experimental"
          />
          <FeatureCard
            href="/vision-chat"
            title="Vision Chat"
            description="Upload images and ask questions about them with a vision-language model"
            icon={Eye}
            modelSize="~500 MB"
            status="experimental"
          />
        </CategorySection>

        <CategorySection title="Text & Language" icon={MessageSquare}>
          <FeatureCard
            href="/chat"
            title="Chat"
            description="Chat with local LLMs featuring streaming and thinking support"
            icon={MessageSquare}
            modelSize="570 MB-2.1 GB"
          />
          <FeatureCard
            href="/translation"
            title="Translation"
            description="Translate between 200 languages with Meta's NLLB"
            icon={Languages}
            modelSize="~600 MB"
            status="experimental"
          />
          <FeatureCard
            href="/semantic-search"
            title="Semantic Search"
            description="Search documents by meaning, not just keywords"
            icon={Search}
            modelSize="~25 MB"
            status="experimental"
          />
        </CategorySection>

        <CategorySection title="GPU Compute" icon={Atom}>
          <FeatureCard
            href="/particle-simulator"
            title="Particle Simulator"
            description="Mesmerizing GPU-powered physics with 10k+ particles using compute shaders"
            icon={Atom}
            modelSize="No model"
            status="experimental"
          />
        </CategorySection>
        </>}

        {/* Footer */}
        <footer className="mt-8 flex flex-col items-center gap-4">
          <p className="text-xs" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser — no data leaves your device
          </p>
          <p className="text-[11px]" style={{ color: "var(--muted-light)" }}>
            Features marked <span style={{ color: "var(--warning, #b8860b)" }} className="font-semibold">BETA</span> are experimental and may not work as expected.{" "}
            <span style={{ color: "var(--error)" }} className="font-semibold">WIP</span> features are known to have issues.
          </p>

          {/* GitHub + Version row */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/jakerains/webgpustudio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105 active:scale-95"
              style={{
                background: "var(--surface)",
                color: "var(--muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
            <button
              onClick={() => setShowChangelog(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                fontFamily: "var(--font-mono)",
                background: "var(--surface)",
                color: "var(--muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--success)" }}
              />
              v{APP_VERSION}
            </button>
          </div>

          {/* Attribution */}
          <a
            href="https://jakerains.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{
              fontFamily: "var(--font-geist-pixel-square)",
              color: "var(--foreground)",
            }}
          >
            a <span className="text-[13px]" style={{ color: "var(--accent)" }}>JAKE RAINS</span> project
          </a>
        </footer>

        <ChangelogModal
          isOpen={showChangelog}
          onClose={() => setShowChangelog(false)}
        />
      </div>
    </main>
  );
}
