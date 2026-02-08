export interface TTSModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  supportsAsr?: boolean;
  supportsTts?: boolean;
  supportsInterleaved?: boolean;
  voiceProfile?: string;
}

export const TTS_MODELS: TTSModelOption[] = [
  {
    id: "LiquidAI/LFM2.5-Audio-1.5B-ONNX",
    label: "LFM2.5 Audio (Q4)",
    size: "~1.5 GB",
    description: "Liquid multimodal audio model with high-quality TTS",
    supportsAsr: true,
    supportsTts: true,
    supportsInterleaved: true,
    voiceProfile: "UK female voice",
  },
  {
    id: "Xenova/speecht5_tts",
    label: "SpeechT5",
    size: "~150 MB",
    description: "Microsoft SpeechT5 text-to-speech",
    supportsTts: true,
    voiceProfile: "Default SpeechT5 speaker",
  },
];

export const DEFAULT_TTS_MODEL_ID = TTS_MODELS[0].id;
export const SPEECHT5_SPEAKER_EMBEDDINGS_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";
