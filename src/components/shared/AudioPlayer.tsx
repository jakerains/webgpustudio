"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download, Volume2 } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  filename?: string;
  showDownload?: boolean;
}

export function AudioPlayer({
  audioUrl,
  filename = "audio.wav",
  showDownload = true,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = filename;
    a.click();
  };

  const formatTime = (t: number) => {
    if (!isFinite(t)) return "0:00";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
          style={{
            background: "var(--accent)",
            boxShadow: "0 2px 8px rgba(194, 114, 78, 0.3)",
          }}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-white" fill="white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
          )}
        </button>

        <div className="flex-1 flex flex-col gap-1">
          <div className="relative w-full h-1.5 rounded-full" style={{ background: "var(--border-subtle)" }}>
            <div
              className="absolute h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--accent), var(--accent-light))",
              }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: "var(--muted-light)", fontFamily: "var(--font-mono)" }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <Volume2 className="w-4 h-4 shrink-0" style={{ color: "var(--muted-light)" }} />

        {showDownload && (
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--muted)" }}
            title="Download audio"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
