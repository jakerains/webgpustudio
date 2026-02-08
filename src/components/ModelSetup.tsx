"use client";

import { Settings, Download, CheckCircle2, AlertCircle, Cpu, Zap, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { ProgressBar } from "./ProgressBar";
import { StatusIndicator } from "./StatusIndicator";
import type { TranscriberProgressItem } from "@/types/transcriber";
import { WHISPER_MODELS } from "@/lib/constants";

interface ModelSetupProps {
  isModelLoading: boolean;
  isModelReady: boolean;
  progressItems: TranscriberProgressItem[];
  error: string | null;
  device: "webgpu" | "wasm";
  modelId: string;
  isWebGPUSupported: boolean;
  onDeviceChange: (device: "webgpu" | "wasm") => void;
  onModelChange: (modelId: string) => void;
  onLoadModel: () => void;
}

export function ModelSetup({
  isModelLoading,
  isModelReady,
  progressItems,
  error,
  device,
  modelId,
  isWebGPUSupported,
  onDeviceChange,
  onModelChange,
  onLoadModel,
}: ModelSetupProps) {
  const selectedModel = WHISPER_MODELS.find((m) => m.id === modelId) ?? WHISPER_MODELS[0];
  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Model Setup</h2>
        </div>
        <StatusIndicator
          status={isModelReady ? "ready" : isModelLoading ? "loading" : error ? "error" : "idle"}
        />
      </div>

      {!isModelReady && (
        <>
          {/* Device Toggle */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 mb-2 block">Inference Device</label>
            <div className="flex gap-2">
              <button
                onClick={() => onDeviceChange("webgpu")}
                disabled={!isWebGPUSupported || isModelLoading}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  device === "webgpu"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                    : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10",
                  (!isWebGPUSupported || isModelLoading) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Zap className="w-4 h-4" />
                WebGPU
              </button>
              <button
                onClick={() => onDeviceChange("wasm")}
                disabled={isModelLoading}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  device === "wasm"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                    : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10",
                  isModelLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <Cpu className="w-4 h-4" />
                WASM
              </button>
            </div>
          </div>

          {/* Model Selector */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 mb-2 block">Model</label>
            <div className="relative">
              <select
                value={modelId}
                onChange={(e) => onModelChange(e.target.value)}
                disabled={isModelLoading}
                className={clsx(
                  "w-full appearance-none px-4 py-2.5 pr-10 rounded-lg text-sm font-medium transition-all bg-white/5 text-gray-200 border border-white/10 hover:bg-white/10 focus:outline-none focus:border-violet-500/40",
                  isModelLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                {WHISPER_MODELS.map((model) => (
                  <option key={model.id} value={model.id} className="bg-gray-900 text-gray-200">
                    {model.label} — {model.size}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{selectedModel.description}</p>
          </div>

          {/* Load Button */}
          <button
            onClick={onLoadModel}
            disabled={isModelLoading}
            className={clsx(
              "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
              isModelLoading
                ? "bg-violet-500/20 text-violet-300 cursor-wait"
                : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20"
            )}
          >
            {isModelLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-violet-300/30 border-t-violet-300 rounded-full animate-spin" />
                Loading Model...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Load Whisper Model
              </>
            )}
          </button>

          {/* Progress */}
          <ProgressBar items={progressItems} />

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </>
      )}

      {isModelReady && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Model Ready</p>
            <p className="text-xs text-emerald-400/60">
              {selectedModel.label} loaded on {device === "webgpu" ? "WebGPU" : "WASM"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
