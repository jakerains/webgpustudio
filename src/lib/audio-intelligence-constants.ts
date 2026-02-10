export interface AudioIntelligenceModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  dtype: Record<string, string>;
  maxTokens: number;
  languages: string[];
}

export const AUDIO_INTELLIGENCE_MODELS: AudioIntelligenceModelOption[] = [
  {
    id: "onnx-community/Voxtral-Mini-3B-2507-ONNX",
    label: "Voxtral Mini 3B",
    size: "~2 GB",
    description:
      "Multimodal audio-text model — transcribe, summarize, and answer questions about audio",
    dtype: {
      embed_tokens: "fp16",
      audio_encoder: "q4",
      decoder_model_merged: "q4",
    },
    maxTokens: 1024,
    languages: ["en", "es", "fr", "pt", "hi", "de", "nl", "it"],
  },
];

export const DEFAULT_AI_MODEL_ID = AUDIO_INTELLIGENCE_MODELS[0].id;

export const AUDIO_INTELLIGENCE_SUGGESTIONS = [
  { label: "Transcribe (EN)", prompt: "Transcribe this audio in English." },
  { label: "Transcribe (ES)", prompt: "Transcribe this audio in Spanish." },
  { label: "Describe this audio", prompt: "Describe what you hear in this audio." },
  { label: "Summarize", prompt: "Summarize what was said in this audio." },
  { label: "What language?", prompt: "What language is being spoken in this audio?" },
];

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  hi: "Hindi",
  de: "German",
  nl: "Dutch",
  it: "Italian",
};
