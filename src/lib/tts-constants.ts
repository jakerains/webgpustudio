export interface TTSModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const TTS_MODELS: TTSModelOption[] = [
  {
    id: "Xenova/speecht5_tts",
    label: "SpeechT5",
    size: "~150 MB",
    description: "Microsoft SpeechT5 text-to-speech",
  },
];

export const DEFAULT_TTS_MODEL_ID = TTS_MODELS[0].id;
export const SPEAKER_EMBEDDINGS_ID = "Xenova/speecht5_tts";
