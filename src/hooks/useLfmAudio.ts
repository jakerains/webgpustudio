"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LFM_AUDIO_MODEL,
  LFM_AUDIO_SAMPLE_RATE,
  LFM_STREAMING_DEFAULTS,
} from "@/lib/lfm-audio-constants";
import { float32ToWav } from "@/lib/canvas-utils";
import type {
  LfmAudioOutput,
  LfmInterleavedTurn,
  LfmProgressItem,
  LfmWorkerOutgoingMessage,
} from "@/types/lfm-audio";

interface UseLfmAudioState {
  isModelLoading: boolean;
  isModelReady: boolean;
  progressItems: LfmProgressItem[];
  error: string | null;

  asrText: string;
  isTranscribing: boolean;
  transcribe: (audio: Float32Array, sampleRate: number) => void;

  ttsTextOutput: string;
  ttsAudio: LfmAudioOutput | null;
  isSynthesizing: boolean;
  synthesize: (text: string) => void;

  isSessionActive: boolean;
  isSessionProcessing: boolean;
  liveInterleavedText: string;
  turns: LfmInterleavedTurn[];
  analyserNode: AnalyserNode | null;
  startContinuousSession: () => Promise<void>;
  stopContinuousSession: () => void;
  clearTurns: () => void;

  loadModel: () => void;
  resetInterleavedConversation: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    sum += sample * sample;
  }

  return Math.sqrt(sum / samples.length);
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const output = new Float32Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function toAudioUrl(audio: Float32Array, samplingRate: number): string {
  const wav = float32ToWav(audio, samplingRate);
  return URL.createObjectURL(wav);
}

export function useLfmAudio(): UseLfmAudioState {
  const workerRef = useRef<Worker | null>(null);

  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [progressItems, setProgressItems] = useState<LfmProgressItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [asrText, setAsrText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [ttsTextOutput, setTtsTextOutput] = useState("");
  const [ttsAudio, setTtsAudio] = useState<LfmAudioOutput | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSessionProcessing, setIsSessionProcessing] = useState(false);
  const [liveInterleavedText, setLiveInterleavedText] = useState("");
  const [turns, setTurns] = useState<LfmInterleavedTurn[]>([]);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const audioUrlsRef = useRef<string[]>([]);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const hopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureQueueRef = useRef<Float32Array[]>([]);
  const turnBuffersRef = useRef<Float32Array[]>([]);
  const hasSpeechRef = useRef(false);
  const silenceMsRef = useRef(0);
  const isSendingTurnRef = useRef(false);

  const resetStreamingBuffers = useCallback(() => {
    captureQueueRef.current = [];
    turnBuffersRef.current = [];
    hasSpeechRef.current = false;
    silenceMsRef.current = 0;
  }, []);

  const resetInterleavedConversation = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "reset_interleaved" });
    resetStreamingBuffers();
    setLiveInterleavedText("");
  }, [resetStreamingBuffers]);

  const clearTurns = useCallback(() => {
    for (const url of audioUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    audioUrlsRef.current = [];
    setTurns([]);
  }, []);

  const handleInterleavedResult = useCallback(
    (data: {
      transcript: string;
      responseText: string;
      audio: LfmAudioOutput | null;
    }) => {
      let audio: LfmAudioOutput | null = null;

      if (data.audio?.audio && data.audio.samplingRate) {
        audio = {
          audio: data.audio.audio,
          samplingRate: data.audio.samplingRate,
        };
      }

      if (audio) {
        const url = toAudioUrl(audio.audio, audio.samplingRate);
        audioUrlsRef.current.push(url);

        const turn: LfmInterleavedTurn = {
          id: generateId(),
          transcript: data.transcript,
          responseText: data.responseText,
          audio,
          audioUrl: url,
          createdAt: Date.now(),
        };

        setTurns((prev) => [...prev, turn]);

        const nextPlayback = new Audio(url);
        nextPlayback.onended = () => {
          playbackRef.current = null;
        };

        playbackRef.current = nextPlayback;
        void nextPlayback.play().catch(() => {
          // Autoplay can fail depending on browser policy.
        });
      } else {
        const turn: LfmInterleavedTurn = {
          id: generateId(),
          transcript: data.transcript,
          responseText: data.responseText,
          audio: null,
          createdAt: Date.now(),
        };

        setTurns((prev) => [...prev, turn]);
      }

      setLiveInterleavedText("");
      setIsSessionProcessing(false);
      isSendingTurnRef.current = false;
    },
    []
  );

  useEffect(() => {
    const worker = new Worker(
      new URL("../app/lfm-audio/lfm-audio-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<LfmWorkerOutgoingMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "initiate": {
          const data = message.data;
          setProgressItems((prev) => {
            const existing = prev.find((item) => item.file === data.file);
            if (existing) return prev;
            return [...prev, data];
          });
          break;
        }
        case "progress": {
          const data = message.data;
          setProgressItems((prev) =>
            prev.map((item) =>
              item.file === data.file
                ? {
                    ...item,
                    progress: data.progress,
                    loaded: data.loaded,
                    total: data.total,
                    status: "progress",
                  }
                : item
            )
          );
          break;
        }
        case "done": {
          const data = message.data;
          setProgressItems((prev) =>
            prev.map((item) =>
              item.file === data.file
                ? {
                    ...item,
                    progress: 100,
                    loaded: data.total,
                    status: "done",
                  }
                : item
            )
          );
          break;
        }
        case "ready":
          setIsModelLoading(false);
          setIsModelReady(true);
          break;
        case "asr_partial":
          setAsrText(message.data.text);
          setLiveInterleavedText(message.data.text);
          break;
        case "asr_result":
          setAsrText(message.data.text);
          setIsTranscribing(false);
          break;
        case "tts_result":
          setIsSynthesizing(false);
          setTtsTextOutput(message.data.text);
          setTtsAudio({
            audio: message.data.audio,
            samplingRate: message.data.samplingRate,
          });
          break;
        case "interleaved_result":
          handleInterleavedResult(message.data);
          break;
        case "reset_done":
          setLiveInterleavedText("");
          break;
        case "error":
          setError(message.data.message);
          setIsModelLoading(false);
          setIsSynthesizing(false);
          setIsTranscribing(false);
          setIsSessionProcessing(false);
          isSendingTurnRef.current = false;
          break;
      }
    };

    workerRef.current = worker;

    return () => {
      worker.postMessage({ type: "dispose" });
      worker.terminate();

      for (const url of audioUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      audioUrlsRef.current = [];
    };
  }, [handleInterleavedResult]);

  const loadModel = useCallback(() => {
    if (!workerRef.current) return;
    setIsModelLoading(true);
    setIsModelReady(false);
    setError(null);
    setProgressItems([]);
    workerRef.current.postMessage({
      type: "load",
      modelId: LFM_AUDIO_MODEL.id,
    });
  }, []);

  const transcribe = useCallback((audio: Float32Array, sampleRate: number) => {
    if (!workerRef.current) return;
    setIsTranscribing(true);
    setAsrText("");
    setError(null);
    workerRef.current.postMessage(
      {
        type: "asr",
        audio,
        sampleRate,
      },
      [audio.buffer]
    );
  }, []);

  const synthesize = useCallback((text: string) => {
    if (!workerRef.current || !text.trim()) return;
    setIsSynthesizing(true);
    setTtsAudio(null);
    setTtsTextOutput("");
    setError(null);
    workerRef.current.postMessage({
      type: "tts",
      text,
    });
  }, []);

  const stopContinuousSession = useCallback(() => {
    if (hopTimerRef.current) {
      clearInterval(hopTimerRef.current);
      hopTimerRef.current = null;
    }

    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }

    resetStreamingBuffers();
    isSendingTurnRef.current = false;
    setAnalyserNode(null);
    setIsSessionProcessing(false);
    setIsSessionActive(false);
  }, [resetStreamingBuffers]);

  const startContinuousSession = useCallback(async () => {
    if (!workerRef.current || isSessionActive || !isModelReady) return;

    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: LFM_AUDIO_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioContext = new AudioContext({
        sampleRate: LFM_AUDIO_SAMPLE_RATE,
      });

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        const copy = new Float32Array(channel.length);
        copy.set(channel);
        captureQueueRef.current.push(copy);
      };

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      gainNodeRef.current = silentGain;

      setAnalyserNode(analyser);

      workerRef.current.postMessage({ type: "reset_interleaved" });
      resetStreamingBuffers();
      isSendingTurnRef.current = false;
      setLiveInterleavedText("");
      setIsSessionActive(true);

      hopTimerRef.current = setInterval(() => {
        if (isSendingTurnRef.current) {
          captureQueueRef.current = [];
          return;
        }

        const chunks = captureQueueRef.current;
        if (chunks.length === 0) return;

        captureQueueRef.current = [];
        const hopAudio = concatFloat32(chunks);
        const rms = computeRms(hopAudio);
        const isSpeech = rms >= LFM_STREAMING_DEFAULTS.vadThreshold;

        if (isSpeech && playbackRef.current && !playbackRef.current.paused) {
          playbackRef.current.pause();
        }

        if (isSpeech) {
          hasSpeechRef.current = true;
          silenceMsRef.current = 0;
          turnBuffersRef.current.push(hopAudio);
          return;
        }

        if (!hasSpeechRef.current) {
          return;
        }

        silenceMsRef.current += LFM_STREAMING_DEFAULTS.hopMs;
        turnBuffersRef.current.push(hopAudio);

        if (silenceMsRef.current < LFM_STREAMING_DEFAULTS.silenceMs) {
          return;
        }

        const turnAudio = concatFloat32(turnBuffersRef.current);
        const turnDurationMs =
          (turnAudio.length / LFM_AUDIO_SAMPLE_RATE) * 1000;

        resetStreamingBuffers();

        if (turnDurationMs < LFM_STREAMING_DEFAULTS.minTurnMs) {
          return;
        }

        isSendingTurnRef.current = true;
        setIsSessionProcessing(true);

        if (!workerRef.current) return;

        workerRef.current.postMessage(
          {
            type: "interleaved",
            audio: turnAudio,
            sampleRate: LFM_AUDIO_SAMPLE_RATE,
          },
          [turnAudio.buffer]
        );
      }, LFM_STREAMING_DEFAULTS.hopMs);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to start continuous audio session";
      setError(message);
      stopContinuousSession();
    }
  }, [isModelReady, isSessionActive, resetStreamingBuffers, stopContinuousSession]);

  useEffect(() => {
    return () => {
      stopContinuousSession();
    };
  }, [stopContinuousSession]);

  return {
    isModelLoading,
    isModelReady,
    progressItems,
    error,

    asrText,
    isTranscribing,
    transcribe,

    ttsTextOutput,
    ttsAudio,
    isSynthesizing,
    synthesize,

    isSessionActive,
    isSessionProcessing,
    liveInterleavedText,
    turns,
    analyserNode,
    startContinuousSession,
    stopContinuousSession,
    clearTurns,

    loadModel,
    resetInterleavedConversation,
  };
}
