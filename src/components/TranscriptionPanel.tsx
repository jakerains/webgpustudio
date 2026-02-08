"use client";

import { Mic, Square, Clock } from "lucide-react";
import { clsx } from "clsx";
import { AudioVisualizer } from "./AudioVisualizer";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { StatusIndicator } from "./StatusIndicator";
import type { TranscriberData } from "@/types/transcriber";

interface TranscriptionPanelProps {
  isModelReady: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  duration: number;
  transcript: TranscriberData | null;
  audioError: string | null;
  analyserNode: AnalyserNode | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptionPanel({
  isModelReady,
  isRecording,
  isTranscribing,
  duration,
  transcript,
  audioError,
  analyserNode,
  onStartRecording,
  onStopRecording,
}: TranscriptionPanelProps) {
  const currentStatus = isRecording
    ? "recording"
    : isTranscribing
    ? "transcribing"
    : isModelReady
    ? "ready"
    : "idle";

  return (
    <div className="space-y-4">
      {/* Controls Card */}
      <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Transcription</h2>
          <StatusIndicator status={currentStatus} />
        </div>

        {/* Mic Button */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {/* Pulse rings when recording */}
            {isRecording && (
              <>
                <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
                <div
                  className="absolute -inset-3 rounded-full border-2 border-rose-500/30"
                  style={{ animation: "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
                />
              </>
            )}
            <button
              onClick={isRecording ? onStopRecording : onStartRecording}
              disabled={!isModelReady || isTranscribing}
              className={clsx(
                "relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all",
                isRecording
                  ? "bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/30"
                  : isModelReady && !isTranscribing
                  ? "bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-500/30 hover:scale-105"
                  : "bg-gray-700 cursor-not-allowed opacity-50"
              )}
            >
              {isRecording ? (
                <Square className="w-7 h-7 text-white" fill="white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
          </div>

          {/* Duration */}
          {(isRecording || duration > 0) && (
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono">{formatDuration(duration)}</span>
            </div>
          )}

          {/* Helper text */}
          {!isModelReady && (
            <p className="text-xs text-gray-500">Load the model first to start recording</p>
          )}
          {isModelReady && !isRecording && !isTranscribing && (
            <p className="text-xs text-gray-500">Click the mic to start recording</p>
          )}
          {isRecording && (
            <p className="text-xs text-rose-400">Recording... Click stop when done</p>
          )}
          {isTranscribing && (
            <p className="text-xs text-amber-400">Processing your audio...</p>
          )}
        </div>

        {/* Audio Error */}
        {audioError && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-300">{audioError}</p>
          </div>
        )}

        {/* Visualizer */}
        <div className="mt-6">
          <AudioVisualizer analyserNode={analyserNode} isRecording={isRecording} />
        </div>
      </div>

      {/* Transcript */}
      <TranscriptDisplay transcript={transcript} isTranscribing={isTranscribing} />
    </div>
  );
}
