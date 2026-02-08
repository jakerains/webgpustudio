"use client";

import { useState } from "react";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";
import { ProgressBar } from "@/components/ProgressBar";
import { SEARCH_MODELS } from "@/lib/search-constants";
import { Search, Database, Loader2, AlertCircle } from "lucide-react";

export default function SemanticSearchPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();
  const ss = useSemanticSearch();
  const [documentsText, setDocumentsText] = useState("");
  const [queryText, setQueryText] = useState("");

  const selectedModel =
    SEARCH_MODELS.find((m) => m.id === ss.modelId) ?? SEARCH_MODELS[0];

  const handleIndex = () => {
    const docs = documentsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (docs.length > 0) {
      ss.indexDocuments(docs);
    }
  };

  const handleSearch = () => {
    if (queryText.trim()) {
      ss.search(queryText.trim(), 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

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
              <Search className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Semantic Search
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Index documents and search by meaning, not just keywords. Powered by sentence embeddings running entirely in your browser.
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
              onClick={ss.loadModel}
              disabled={ss.isModelLoading || ss.isModelReady}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: ss.isModelReady ? "var(--success-bg)" : "var(--accent)",
                color: ss.isModelReady ? "var(--success)" : "#fff",
                opacity: ss.isModelLoading ? 0.7 : 1,
                border: ss.isModelReady ? "1px solid var(--success-border)" : "none",
              }}
            >
              {ss.isModelLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading...
                </span>
              ) : ss.isModelReady ? (
                "Ready"
              ) : (
                "Load Model"
              )}
            </button>
          </div>
          <ProgressBar items={ss.progressItems} />
          {ss.error && (
            <div
              className="mt-3 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--error-bg)", color: "var(--error)" }}
            >
              {ss.error}
            </div>
          )}
        </div>

        {/* Document Input */}
        {ss.isModelReady && (
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Documents
                </h2>
              </div>
              {ss.indexedCount > 0 && (
                <span
                  className="text-xs px-2 py-1 rounded-md"
                  style={{ background: "var(--success-bg)", color: "var(--success)" }}
                >
                  {ss.indexedCount} indexed
                </span>
              )}
            </div>
            <textarea
              value={documentsText}
              onChange={(e) => setDocumentsText(e.target.value)}
              placeholder="Paste your documents here, one per line...&#10;&#10;Example:&#10;The Eiffel Tower is located in Paris, France.&#10;Machine learning is a subset of artificial intelligence.&#10;The Great Wall of China is visible from space."
              rows={8}
              className="w-full rounded-lg p-3 text-sm resize-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                color: "var(--foreground)",
              }}
            />
            <button
              onClick={handleIndex}
              disabled={ss.isIndexing || !documentsText.trim()}
              className="mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: "var(--accent)",
                color: "#fff",
                opacity: ss.isIndexing || !documentsText.trim() ? 0.5 : 1,
              }}
            >
              {ss.isIndexing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Indexing...
                </span>
              ) : (
                "Index Documents"
              )}
            </button>
          </div>
        )}

        {/* Search */}
        {ss.indexedCount > 0 && (
          <div className="card p-5 mb-6">
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
              Search
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your search query..."
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--foreground)",
                }}
              />
              <button
                onClick={handleSearch}
                disabled={ss.isSearching || !queryText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  opacity: ss.isSearching || !queryText.trim() ? 0.5 : 1,
                }}
              >
                {ss.isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                Search
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {ss.results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Results
            </h2>
            {ss.results.map((result, i) => (
              <div
                key={result.index}
                className="card p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                      background: "var(--accent-bg)",
                      color: "var(--accent)",
                      border: "1px solid var(--accent-border)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                      {result.text}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1">
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--border-subtle)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(result.score * 100, 2)}%`,
                              background: "linear-gradient(90deg, var(--accent), var(--accent-light))",
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className="text-xs font-mono shrink-0"
                        style={{ color: "var(--muted)" }}
                      >
                        {result.score.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
            <span>Powered by</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Transformers.js</span>
            <span>&</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>MiniLM</span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
