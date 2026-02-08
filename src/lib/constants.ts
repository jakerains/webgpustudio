export const SAMPLING_RATE = 16000;
export const DEFAULT_MODEL_ID = "onnx-community/whisper-tiny.en";
export const CHUNK_LENGTH_S = 30;
export const STRIDE_LENGTH_S = 5;
export const DEFAULT_LANGUAGE = "en";

export interface WhisperModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const WHISPER_MODELS: WhisperModelOption[] = [
  {
    id: "onnx-community/whisper-tiny.en",
    label: "Tiny (English)",
    size: "~39 MB",
    description: "Fastest, lowest accuracy",
  },
  {
    id: "onnx-community/whisper-base.en",
    label: "Base (English)",
    size: "~74 MB",
    description: "Good balance of speed and accuracy",
  },
  {
    id: "onnx-community/whisper-small.en",
    label: "Small (English)",
    size: "~244 MB",
    description: "Higher accuracy, slower loading",
  },
  {
    id: "onnx-community/whisper-tiny",
    label: "Tiny (Multilingual)",
    size: "~39 MB",
    description: "99 languages, lower accuracy",
  },
  {
    id: "onnx-community/whisper-base",
    label: "Base (Multilingual)",
    size: "~74 MB",
    description: "99 languages, moderate accuracy",
  },
];
