"use client";

import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { ProgressBar } from "@/components/ProgressBar";
import { TRANSLATION_MODELS, LANGUAGES } from "@/lib/translation-constants";
import { Languages, ArrowRightLeft, Loader2, AlertCircle } from "lucide-react";

export default function TranslationPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();
  const tl = useTranslation();
  const [sourceText, setSourceText] = useState("");
  const [srcLang, setSrcLang] = useState("eng_Latn");
  const [tgtLang, setTgtLang] = useState("spa_Latn");

  const selectedModel =
    TRANSLATION_MODELS.find((m) => m.id === tl.modelId) ?? TRANSLATION_MODELS[0];

  const handleTranslate = () => {
    if (sourceText.trim()) {
      tl.translate(sourceText.trim(), srcLang, tgtLang);
    }
  };

  const handleSwap = () => {
    const oldSrc = srcLang;
    const oldTgt = tgtLang;
    const oldSourceText = sourceText;
    const oldTranslated = tl.translatedText;
    setSrcLang(oldTgt);
    setTgtLang(oldSrc);
    setSourceText(oldTranslated);
    // Don't auto-translate on swap, let user trigger it
  };

  const srcLangName = LANGUAGES.find((l) => l.code === srcLang)?.name ?? srcLang;
  const tgtLangName = LANGUAGES.find((l) => l.code === tgtLang)?.name ?? tgtLang;

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-border)" }}
            >
              <Languages className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Translation
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Translate between 20 languages using Meta&apos;s NLLB-200 model, running entirely in your browser.
          </p>
          {!isCheckingWebGPU && !isWebGPUSupported && (
            <div
              className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--warning-border)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              WebGPU not available. Inference may be slower.
            </div>
          )}
        </div>

        {/* Model Setup */}
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {selectedModel.label}
              </h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {selectedModel.description} ({selectedModel.size})
              </p>
            </div>
            <button
              onClick={tl.loadModel}
              disabled={tl.isModelLoading || tl.isModelReady}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tl.isModelReady ? "var(--success-bg)" : "var(--accent)",
                color: tl.isModelReady ? "var(--success)" : "#fff",
                opacity: tl.isModelLoading ? 0.7 : 1,
                border: tl.isModelReady ? "1px solid var(--success-border)" : "none",
              }}
            >
              {tl.isModelLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading...
                </span>
              ) : tl.isModelReady ? (
                "Ready"
              ) : (
                "Load Model"
              )}
            </button>
          </div>
          {tl.isModelLoading && (
            <div
              className="mb-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--surface)", color: "var(--muted)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              This model is ~600 MB. First load may take a moment.
            </div>
          )}
          <ProgressBar items={tl.progressItems} />
          {tl.error && (
            <div
              className="mt-3 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--error-bg)", color: "var(--error)" }}
            >
              {tl.error}
            </div>
          )}
        </div>

        {/* Translation Interface */}
        {tl.isModelReady && (
          <div className="card p-5 mb-6">
            {/* Language Selectors */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted)" }}>
                  From
                </label>
                <select
                  value={srcLang}
                  onChange={(e) => setSrcLang(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--foreground)",
                  }}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSwap}
                className="mt-5 p-2 rounded-lg transition-all hover:opacity-70"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--accent)",
                }}
                title="Swap languages"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>

              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted)" }}>
                  To
                </label>
                <select
                  value={tgtLang}
                  onChange={(e) => setTgtLang(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--foreground)",
                  }}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Side-by-side text areas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    {srcLangName}
                  </label>
                  <span className="text-xs" style={{ color: "var(--muted-light)" }}>
                    {sourceText.length} chars
                  </span>
                </div>
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Enter text to translate..."
                  rows={6}
                  className="w-full rounded-lg p-3 text-sm resize-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    {tgtLangName}
                  </label>
                </div>
                <textarea
                  value={tl.translatedText}
                  readOnly
                  placeholder="Translation will appear here..."
                  rows={6}
                  className="w-full rounded-lg p-3 text-sm resize-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--foreground)",
                    opacity: tl.translatedText ? 1 : 0.5,
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleTranslate}
              disabled={tl.isTranslating || !sourceText.trim()}
              className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{
                background: "var(--accent)",
                color: "#fff",
                opacity: tl.isTranslating || !sourceText.trim() ? 0.5 : 1,
              }}
            >
              {tl.isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Languages className="w-4 h-4" />
                  Translate
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
            <span>Powered by</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Transformers.js</span>
            <span>&</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>NLLB-200</span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
