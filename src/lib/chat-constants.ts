export interface ChatGenerationConfig {
  do_sample?: boolean;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
}

export interface ChatModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
  dtype: string | Record<string, string>;
  maxTokens: number;
  systemPrompt?: string;
  useProcessor?: boolean;
  generationConfig?: ChatGenerationConfig;
}

export const CHAT_MODELS: ChatModelOption[] = [
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    label: "Qwen3 (0.6B)",
    size: "~570 MB",
    description: "Lightweight Qwen3 model, fast inference",
    dtype: "q4f16",
    maxTokens: 512,
  },
  {
    id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
    label: "Llama 3.2 (1B)",
    size: "~1.1 GB",
    description: "Meta Llama 3.2 instruct, 128K context",
    dtype: "q4f16",
    maxTokens: 512,
  },
  {
    id: "LiquidAI/LFM2.5-1.2B-Instruct-ONNX",
    label: "LFM 2.5 (1.2B)",
    size: "~1.2 GB",
    description: "Liquid AI hybrid model, optimized for edge",
    dtype: "q4",
    maxTokens: 512,
  },
  {
    id: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
    label: "DeepSeek-R1 (1.5B)",
    size: "~1.0 GB",
    description: "DeepSeek-R1 reasoning distilled into Qwen 1.5B",
    dtype: "q4f16",
    maxTokens: 512,
  },
  {
    id: "onnx-community/Qwen3-1.7B-ONNX",
    label: "Qwen3 (1.7B)",
    size: "~1.4 GB",
    description: "Mid-size Qwen3 with thinking mode support",
    dtype: "q4f16",
    maxTokens: 512,
  },
  {
    id: "onnx-community/LFM2-2.6B-ONNX",
    label: "LFM2 (2.6B)",
    size: "~1.7 GB",
    description: "Liquid AI hybrid model with dynamic reasoning",
    dtype: "q4f16",
    maxTokens: 512,
  },
  {
    id: "HuggingFaceTB/SmolLM3-3B-ONNX",
    label: "SmolLM3 (3B)",
    size: "~2.1 GB",
    description: "HuggingFace 3B model, 6 languages, 128k context",
    dtype: "q4f16",
    maxTokens: 1024,
  },
  {
    id: "onnx-community/Qwen3-4B-ONNX",
    label: "Qwen3 (4B)",
    size: "~2.8 GB",
    description: "Largest Qwen3 ONNX, highest quality for powerful GPUs",
    dtype: "q4f16",
    maxTokens: 1024,
  },
];

export const DEFAULT_CHAT_MODEL_ID = CHAT_MODELS[0].id;

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant running inside WebGPU Studio (webgpu.studio), " +
  "an open-source web app that runs machine-learning models entirely in the browser using WebGPU. " +
  "The site offers tools like speech-to-text, text-to-speech, background removal, object detection, " +
  "depth estimation, image segmentation, a particle simulator, and this chat. " +
  "Everything runs locally on the user's GPU — no data leaves their device. " +
  "You can talk about anything the user wants. Be helpful, concise, and conversational.";

export const SUGGESTION_CHIPS = [
  "Explain WebGPU in simple terms",
  "Write a haiku about coding",
  "What can you help me with?",
  "Tell me a fun fact",
];
