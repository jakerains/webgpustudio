"use client";

import {
  Waves,
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
  Gpu,
  Zap,
} from "lucide-react";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { CategorySection } from "@/components/CategorySection";
import { FeatureCard } from "@/components/FeatureCard";

export default function LandingPage() {
  const { isSupported, isChecking } = useWebGPUSupport();

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
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-2"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            WebGPU Studio
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

        {/* Feature Grid by Category */}
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
            description="Convert text to natural-sounding speech with SpeechT5"
            icon={Speech}
            modelSize="~150 MB"
            isNew
          />
          <FeatureCard
            href="/music-generation"
            title="Music Generation"
            description="Generate music from text prompts with Meta's MusicGen"
            icon={Music}
            modelSize="~1.5 GB"
            isNew
          />
        </CategorySection>

        <CategorySection title="Vision & Image" icon={Eye}>
          <FeatureCard
            href="/background-removal"
            title="Background Removal"
            description="Instantly remove image backgrounds with RMBG"
            icon={Scissors}
            modelSize="44-200 MB"
            isNew
          />
          <FeatureCard
            href="/object-detection"
            title="Object Detection"
            description="Real-time object detection with bounding boxes and labels"
            icon={ScanSearch}
            modelSize="29-166 MB"
            isNew
          />
          <FeatureCard
            href="/depth-estimation"
            title="Depth Estimation"
            description="Generate depth maps from 2D images with Depth Anything V2"
            icon={Mountain}
            modelSize="~97 MB"
            isNew
          />
          <FeatureCard
            href="/image-segmentation"
            title="Image Segmentation"
            description="Click to segment objects with Meta's SAM3 — upload or use your camera"
            icon={Shapes}
            modelSize="~301 MB"
            isNew
          />
          <FeatureCard
            href="/vision-chat"
            title="Vision Chat"
            description="Upload images and ask questions about them with a vision-language model"
            icon={Eye}
            modelSize="~500 MB"
            isNew
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
            isNew
          />
          <FeatureCard
            href="/semantic-search"
            title="Semantic Search"
            description="Search documents by meaning, not just keywords"
            icon={Search}
            modelSize="~25 MB"
            isNew
          />
        </CategorySection>

        <CategorySection title="GPU Compute" icon={Atom}>
          <FeatureCard
            href="/particle-simulator"
            title="Particle Simulator"
            description="Mesmerizing GPU-powered physics with 10k+ particles using compute shaders"
            icon={Atom}
            modelSize="No model"
            isNew
          />
        </CategorySection>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-xs" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser — no data leaves your device
          </p>
        </footer>
      </div>
    </main>
  );
}
