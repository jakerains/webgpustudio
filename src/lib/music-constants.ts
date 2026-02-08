export interface MusicModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const MUSIC_MODELS: MusicModelOption[] = [
  {
    id: "Xenova/musicgen-small",
    label: "MusicGen Small",
    size: "~1.5 GB",
    description: "Meta's MusicGen for text-to-music",
  },
];

export const DEFAULT_MUSIC_MODEL_ID = MUSIC_MODELS[0].id;

export const MUSIC_SUGGESTIONS = [
  "Upbeat electronic dance track with synths",
  "Calm acoustic guitar melody",
  "Epic orchestral cinematic theme",
  "Lo-fi hip hop beat with piano",
  "Jazz saxophone solo with drums",
];
