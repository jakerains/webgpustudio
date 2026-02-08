import type { LfmAudioMode } from "@/lib/lfm-audio-constants";

export interface LfmProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  status?: string;
}

export interface LfmAudioOutput {
  audio: Float32Array;
  samplingRate: number;
}

export interface LfmInterleavedTurn {
  id: string;
  transcript: string;
  responseText: string;
  audio: LfmAudioOutput | null;
  audioUrl?: string;
  createdAt: number;
}

export type LfmWorkerOutgoingMessage =
  | { type: "initiate" | "progress" | "done"; data: LfmProgressItem }
  | { type: "ready" }
  | { type: "asr_partial"; data: { text: string } }
  | { type: "asr_result"; data: { text: string } }
  | { type: "tts_result"; data: LfmAudioOutput & { text: string } }
  | {
      type: "interleaved_result";
      data: {
        transcript: string;
        responseText: string;
        audio: LfmAudioOutput | null;
      };
    }
  | { type: "reset_done" }
  | { type: "error"; data: { message: string; mode?: LfmAudioMode } };

export type LfmWorkerIncomingMessage =
  | { type: "load"; modelId: string }
  | { type: "asr"; audio: Float32Array; sampleRate: number }
  | { type: "tts"; text: string }
  | {
      type: "interleaved";
      audio: Float32Array;
      sampleRate: number;
      prompt?: string;
    }
  | { type: "reset_interleaved" }
  | { type: "dispose" };
