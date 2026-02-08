export interface TranslationModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const TRANSLATION_MODELS: TranslationModelOption[] = [
  {
    id: "Xenova/nllb-200-distilled-600M",
    label: "NLLB 200",
    size: "~600 MB",
    description: "200 languages, Meta's No Language Left Behind",
  },
];

export const DEFAULT_TRANSLATION_MODEL_ID = TRANSLATION_MODELS[0].id;

export const LANGUAGES = [
  { code: "eng_Latn", name: "English" },
  { code: "spa_Latn", name: "Spanish" },
  { code: "fra_Latn", name: "French" },
  { code: "deu_Latn", name: "German" },
  { code: "ita_Latn", name: "Italian" },
  { code: "por_Latn", name: "Portuguese" },
  { code: "nld_Latn", name: "Dutch" },
  { code: "rus_Cyrl", name: "Russian" },
  { code: "zho_Hans", name: "Chinese (Simplified)" },
  { code: "jpn_Jpan", name: "Japanese" },
  { code: "kor_Hang", name: "Korean" },
  { code: "arb_Arab", name: "Arabic" },
  { code: "hin_Deva", name: "Hindi" },
  { code: "tur_Latn", name: "Turkish" },
  { code: "vie_Latn", name: "Vietnamese" },
  { code: "tha_Thai", name: "Thai" },
  { code: "swe_Latn", name: "Swedish" },
  { code: "pol_Latn", name: "Polish" },
  { code: "ukr_Cyrl", name: "Ukrainian" },
  { code: "cat_Latn", name: "Catalan" },
];
