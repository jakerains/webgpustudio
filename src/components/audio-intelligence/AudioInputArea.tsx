"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Mic, MicOff, RefreshCw } from "lucide-react";
import { AudioPlayer } from "@/components/shared/AudioPlayer";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { float32ToWav } from "@/lib/canvas-utils";
import { SAMPLING_RATE } from "@/lib/constants";

const ACCEPTED_TYPES = [
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/flac",
  "audio/webm",
  "audio/x-wav",
];

interface AudioInputAreaProps {
  audioUrl: string | null;
  onFileSelect: (file: File) => void;
  onRecordingComplete: (blob: Blob, rawAudio: Float32Array) => void;
  onClear: () => void;
}

export function AudioInputArea({
  audioUrl,
  onFileSelect,
  onRecordingComplete,
  onClear,
}: AudioInputAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const recorder = useAudioRecorder();

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg|flac|webm)$/i)) {
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleStopRecording = useCallback(async () => {
    const audioData = await recorder.stopRecording();
    if (audioData) {
      const wavBlob = float32ToWav(audioData, SAMPLING_RATE);
      onRecordingComplete(wavBlob, audioData);
    }
  }, [recorder, onRecordingComplete]);

  // Show audio preview when loaded
  if (audioUrl) {
    return (
      <div className="space-y-3">
        <AudioPlayer audioUrl={audioUrl} showDownload={false} />
        <button
          onClick={onClear}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-xs font-medium transition-all hover:brightness-95 active:scale-[0.98]"
          style={{
            background: "var(--surface)",
            color: "var(--muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Change audio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl cursor-pointer transition-all"
        style={{
          background: isDragging ? "var(--accent-bg)" : "var(--surface)",
          border: isDragging
            ? "2px dashed var(--accent)"
            : "2px dashed var(--border-subtle)",
        }}
      >
        <Upload
          className="w-8 h-8"
          style={{ color: isDragging ? "var(--accent)" : "var(--muted-light)" }}
        />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Drop an audio file here or click to upload
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            WAV, MP3, OGG, FLAC, WebM
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Record button */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-px"
          style={{ background: "var(--border-subtle)" }}
        />
        <span className="text-xs" style={{ color: "var(--muted-light)" }}>
          or
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "var(--border-subtle)" }}
        />
      </div>

      <button
        onClick={recorder.isRecording ? handleStopRecording : recorder.startRecording}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99]"
        style={{
          background: recorder.isRecording ? "var(--error)" : "var(--surface)",
          color: recorder.isRecording ? "#FFFFFF" : "var(--foreground)",
          border: recorder.isRecording ? "none" : "1px solid var(--border-subtle)",
          boxShadow: recorder.isRecording
            ? "0 2px 12px rgba(194, 84, 84, 0.3)"
            : "none",
        }}
      >
        {recorder.isRecording ? (
          <>
            <MicOff className="w-4 h-4" />
            Stop Recording ({recorder.duration}s)
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            Record from Microphone
          </>
        )}
      </button>

      {recorder.error && (
        <p className="text-xs text-center" style={{ color: "var(--error)" }}>
          {recorder.error}
        </p>
      )}
    </div>
  );
}
