"use client";

import { Waves } from "lucide-react";

interface HeaderProps {
  isWebGPUSupported: boolean;
  isCheckingWebGPU: boolean;
}

export function Header({ isWebGPUSupported, isCheckingWebGPU }: HeaderProps) {
  return (
    <header className="text-center mb-8">
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30">
          <Waves className="w-7 h-7 text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Whisper WebGPU
        </h1>
      </div>
      <p className="text-gray-400 text-sm mb-3">
        Real-time speech-to-text powered by OpenAI Whisper — running entirely in your browser
      </p>
      <div className="flex items-center justify-center gap-2">
        {isCheckingWebGPU ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
            Checking WebGPU...
          </span>
        ) : isWebGPUSupported ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            WebGPU Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            WebGPU Unavailable — Using WASM
          </span>
        )}
      </div>
    </header>
  );
}
