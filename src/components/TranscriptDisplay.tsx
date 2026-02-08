"use client";

import { useRef, useEffect, useState } from "react";
import { Copy, Check, FileText } from "lucide-react";
import type { TranscriberData } from "@/types/transcriber";

interface TranscriptDisplayProps {
  transcript: TranscriberData | null;
  isTranscribing: boolean;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptDisplay({ transcript, isTranscribing }: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleCopy = async () => {
    if (!transcript?.text) return;
    try {
      await navigator.clipboard.writeText(transcript.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const hasContent = transcript && (transcript.text || transcript.chunks.length > 0);

  return (
    <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-300">Transcript</h3>
        </div>
        {hasContent && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-300 transition-all border border-white/10"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="p-4 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
      >
        {!hasContent && !isTranscribing && (
          <p className="text-sm text-gray-500 text-center py-6">
            Transcript will appear here after recording...
          </p>
        )}

        {isTranscribing && !hasContent && (
          <div className="flex items-center gap-2 py-6 justify-center">
            <div className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
            <span className="text-sm text-amber-300">Transcribing audio...</span>
          </div>
        )}

        {hasContent && transcript.chunks.length > 0 && (
          <div className="space-y-2">
            {transcript.chunks.map((chunk, index) => (
              <div key={index} className="flex gap-3">
                <span className="text-xs text-violet-400/70 font-mono pt-0.5 shrink-0">
                  {formatTimestamp(chunk.timestamp[0])}
                </span>
                <p className="text-sm text-gray-200 leading-relaxed">
                  {chunk.text}
                  {index === transcript.chunks.length - 1 && isTranscribing && (
                    <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-blink align-middle" />
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {hasContent && transcript.chunks.length === 0 && transcript.text && (
          <p className="text-sm text-gray-200 leading-relaxed">
            {transcript.text}
            {isTranscribing && (
              <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-blink align-middle" />
            )}
          </p>
        )}
      </div>
    </div>
  );
}
