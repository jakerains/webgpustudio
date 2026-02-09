export type TTSEngine = "kokoro" | "supertonic" | "lfm" | "outetts";

export interface TTSModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  ttsEngine: TTSEngine;
  supportsAsr?: boolean;
  supportsTts?: boolean;
  supportsInterleaved?: boolean;
  voiceProfile?: string;
}

export const TTS_MODELS: TTSModelOption[] = [
  {
    id: "onnx-community/Kokoro-82M-v1.0-ONNX",
    label: "Kokoro TTS v1.0",
    size: "~92 MB (q8)",
    description: "Highest quality browser TTS — 82M params, 30+ voices, natural prosody",
    ttsEngine: "kokoro",
    supportsTts: true,
    voiceProfile: "30+ voices across American & British accents",
  },
  {
    id: "onnx-community/Supertonic-TTS-2-ONNX",
    label: "Supertonic TTS v2",
    size: "~263 MB",
    description: "Ultra-fast TTS — 66M params, 167x real-time speed, male & female voices",
    ttsEngine: "supertonic",
    supportsTts: true,
    voiceProfile: "Female (F1) and Male (M1) speakers",
  },
  {
    id: "LiquidAI/LFM2.5-Audio-1.5B-ONNX",
    label: "LFM2.5 Audio (Q4)",
    size: "~1.5 GB",
    description: "Liquid multimodal audio model with high-quality TTS",
    ttsEngine: "lfm",
    supportsAsr: true,
    supportsTts: true,
    supportsInterleaved: true,
    voiceProfile: "UK female voice",
  },
  {
    id: "onnx-community/OuteTTS-0.2-500M",
    label: "OuteTTS v0.2",
    size: "~125 MB (q4)",
    description: "Multi-language TTS with speaker profiles (EN/CN/JP/KR)",
    ttsEngine: "outetts",
    supportsTts: true,
    voiceProfile: "male_1, female_1, or random",
  },
];

export const KOKORO_VOICES = [
  // American Female
  { id: "af_heart", label: "Heart (American Female)", group: "American Female" },
  { id: "af_bella", label: "Bella (American Female)", group: "American Female" },
  { id: "af_nova", label: "Nova (American Female)", group: "American Female" },
  { id: "af_sky", label: "Sky (American Female)", group: "American Female" },
  { id: "af_sarah", label: "Sarah (American Female)", group: "American Female" },
  { id: "af_nicole", label: "Nicole (American Female)", group: "American Female" },
  // American Male
  { id: "am_adam", label: "Adam (American Male)", group: "American Male" },
  { id: "am_echo", label: "Echo (American Male)", group: "American Male" },
  { id: "am_michael", label: "Michael (American Male)", group: "American Male" },
  { id: "am_puck", label: "Puck (American Male)", group: "American Male" },
  // British Female
  { id: "bf_alice", label: "Alice (British Female)", group: "British Female" },
  { id: "bf_emma", label: "Emma (British Female)", group: "British Female" },
  { id: "bf_lily", label: "Lily (British Female)", group: "British Female" },
  // British Male
  { id: "bm_george", label: "George (British Male)", group: "British Male" },
  { id: "bm_daniel", label: "Daniel (British Male)", group: "British Male" },
  { id: "bm_lewis", label: "Lewis (British Male)", group: "British Male" },
] as const;

export const SUPERTONIC_SPEAKERS = [
  { id: "F1", label: "Female (F1)" },
  { id: "M1", label: "Male (M1)" },
] as const;

export const OUTETTS_SPEAKERS = [
  { id: "male_1", label: "Male" },
  { id: "female_1", label: "Female" },
  { id: "random", label: "Random" },
] as const;

export const DEFAULT_TTS_MODEL_ID = TTS_MODELS[0].id;
