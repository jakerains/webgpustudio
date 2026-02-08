export interface VisionChatModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  dtype: string;
  maxTokens: number;
}

export const VISION_CHAT_MODELS: VisionChatModelOption[] = [
  {
    id: "HuggingFaceTB/SmolVLM-256M-Instruct",
    label: "SmolVLM (256M)",
    size: "~500 MB",
    description: "Compact vision-language model",
    dtype: "q4f16",
    maxTokens: 512,
  },
];

export const DEFAULT_VISION_CHAT_MODEL_ID = VISION_CHAT_MODELS[0].id;

export const VISION_SUGGESTIONS = [
  "Describe what you see in this image",
  "What objects are in the image?",
  "What colors dominate this image?",
  "Is there any text in the image?",
];
