export type LfmAudioMode = "asr" | "tts" | "interleaved";

export interface LfmAudioModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  quantization: {
    decoder: "q4";
    audioEncoder: "q4";
    audioEmbedding: "q4";
    audioDetokenizer: "q4";
    vocoder: "q4";
  };
}

export interface LfmStreamingDefaults {
  chunkMs: number;
  hopMs: number;
  silenceMs: number;
  vadThreshold: number;
  minTurnMs: number;
}

export const LFM_AUDIO_MODEL: LfmAudioModelOption = {
  id: "LiquidAI/LFM2.5-Audio-1.5B-ONNX",
  label: "LFM2.5 Audio (Q4)",
  size: "~1.5 GB",
  description:
    "Liquid multimodal audio model for ASR, TTS, and interleaved voice conversation.",
  quantization: {
    decoder: "q4",
    audioEncoder: "q4",
    audioEmbedding: "q4",
    audioDetokenizer: "q4",
    vocoder: "q4",
  },
};

export const LFM_AUDIO_MODES: Array<{ id: LfmAudioMode; label: string; description: string }> = [
  {
    id: "asr",
    label: "ASR",
    description: "Transcribe speech to text.",
  },
  {
    id: "tts",
    label: "TTS",
    description: "Generate speech from text.",
  },
  {
    id: "interleaved",
    label: "Interleaved",
    description: "Continuous near-real-time audio conversation.",
  },
];

export const LFM_STREAMING_DEFAULTS: LfmStreamingDefaults = {
  chunkMs: 1600,
  hopMs: 800,
  silenceMs: 1200,
  vadThreshold: 0.015,
  minTurnMs: 800,
};

export const LFM_AUDIO_SAMPLE_RATE = 16000;
export const LFM_OUTPUT_SAMPLE_RATE = 24000;
