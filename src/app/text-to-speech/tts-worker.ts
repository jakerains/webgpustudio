import { env, pipeline } from "@huggingface/transformers";
import { AudioModel } from "../../lib/lfm/audio-model.js";

// Engine type for routing — mirrors TTSEngine from tts-constants
type TTSEngine = "kokoro" | "supertonic" | "lfm" | "outetts";

// Constants inlined — Web Workers don't resolve path aliases
const MODEL_ENGINE_MAP: Record<string, TTSEngine> = {
  "onnx-community/Kokoro-82M-v1.0-ONNX": "kokoro",
  "onnx-community/Supertonic-TTS-2-ONNX": "supertonic",
  "LiquidAI/LFM2.5-Audio-1.5B-ONNX": "lfm",
  "onnx-community/OuteTTS-0.2-500M": "outetts",
};

const DEFAULT_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

// Disable local model check — always download from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton model instances
let lfmModel: AudioModel | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let outeTtsInterface: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let kokoroTts: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supertonicPipeline: any = null;

let currentModelId: string | null = null;
let currentEngine: TTSEngine | null = null;

function disposeCurrentModel() {
  if (lfmModel) {
    lfmModel.dispose();
    lfmModel = null;
  }
  outeTtsInterface = null;
  kokoroTts = null;
  supertonicPipeline = null;
  currentModelId = null;
  currentEngine = null;
}

function postProgress(file: string, progress: number, status: "initiate" | "progress" | "done") {
  self.postMessage({
    type: status,
    data: {
      file,
      progress,
      loaded: progress,
      total: 100,
      name: file,
      status,
    },
  });
}

// ─── Kokoro TTS ───────────────────────────────────────────────

async function loadKokoroModel(modelId: string) {
  const { KokoroTTS } = await import("kokoro-js");

  const tts = await KokoroTTS.from_pretrained(modelId, {
    dtype: "q8",
    device: "webgpu",
    progress_callback: (progressData: unknown) => {
      const data = progressData as {
        file?: string;
        progress?: number;
        status?: string;
      };
      const file = data.file ?? "kokoro-model";
      const progress = data.progress ?? 0;
      const status = data.status as "initiate" | "progress" | "done" | undefined;

      if (status === "initiate" || status === "progress" || status === "done") {
        postProgress(file, progress, status);
      }
    },
  });

  kokoroTts = tts;
  currentModelId = modelId;
  currentEngine = "kokoro";
}

async function synthesizeWithKokoro(text: string, voiceId?: string) {
  if (!kokoroTts) {
    throw new Error("Kokoro model not loaded");
  }

  const result = await kokoroTts.generate(text, {
    voice: voiceId || "af_heart",
  });

  // kokoro-js returns { audio: Float32Array, sampling_rate: number }
  const audio = result.audio as Float32Array;
  const samplingRate = result.sampling_rate as number;

  self.postMessage({
    type: "result",
    data: { audio, samplingRate },
  });
}

// ─── Supertonic TTS ───────────────────────────────────────────

async function loadSupertonicModel(modelId: string) {
  const synthesizer = await pipeline("text-to-speech", modelId, {
    device: "webgpu",
    progress_callback: (progressData: unknown) => {
      const data = progressData as {
        file?: string;
        progress?: number;
        status?: string;
      };

      const file = data.file ?? "supertonic-model";
      const progress = data.progress ?? 0;
      const status = data.status as "initiate" | "progress" | "done" | undefined;

      if (status === "initiate" || status === "progress" || status === "done") {
        postProgress(file, progress, status);
      }
    },
  });

  supertonicPipeline = synthesizer;
  currentModelId = modelId;
  currentEngine = "supertonic";
}

async function synthesizeWithSupertonic(text: string, speakerId?: string) {
  if (!supertonicPipeline) {
    throw new Error("Supertonic model not loaded");
  }

  const speaker = speakerId || "F1";
  const speakerUrl = `https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices/${speaker}.bin`;

  // Supertonic v2 requires language tags
  const taggedText = `<en>${text}</en>`;

  const result = await supertonicPipeline(taggedText, {
    speaker_embeddings: speakerUrl,
    num_inference_steps: 10,
    speed: 1.0,
  });

  const audio = result.audio as Float32Array;
  const samplingRate = result.sampling_rate as number;

  self.postMessage({
    type: "result",
    data: { audio, samplingRate },
  });
}

// ─── LFM Audio ────────────────────────────────────────────────

async function loadLfmModel(modelId: string) {
  const modelPath = `https://huggingface.co/${modelId}/resolve/main`;
  const model = new AudioModel();

  await model.load(modelPath, {
    device: "webgpu",
    quantization: {
      decoder: "q4",
      audioEncoder: "q4",
      audioEmbedding: "q4",
      audioDetokenizer: "q4",
      vocoder: "q4",
    },
    progressCallback: (progressData: unknown) => {
      const data = progressData as {
        file?: string;
        progress?: number;
      };
      const file = data.file ?? "lfm-model";
      const progress = data.progress ?? 0;

      postProgress(file, 0, "initiate");
      postProgress(file, progress, "progress");
      if (progress >= 100) {
        postProgress(file, 100, "done");
      }
    },
  });

  lfmModel = model;
  currentModelId = modelId;
  currentEngine = "lfm";
}

async function synthesizeWithLfm(text: string) {
  if (!lfmModel) {
    throw new Error("LFM model not loaded");
  }

  const ttsResult = await lfmModel.generateSpeech(text, {
    maxNewTokens: 1024,
  }) as {
    audioCodes?: number[][];
    textOutput?: string;
  };

  if (!ttsResult.audioCodes || ttsResult.audioCodes.length === 0) {
    throw new Error("No audio frames were generated");
  }

  const waveform = await lfmModel.decodeAudioCodes(ttsResult.audioCodes);

  if (!waveform || waveform.length === 0) {
    throw new Error("Failed to decode generated audio");
  }

  self.postMessage({
    type: "result",
    data: {
      audio: waveform,
      samplingRate: 24000,
      text: ttsResult.textOutput ?? "",
    },
  });
}

// ─── OuteTTS ──────────────────────────────────────────────────

async function loadOuteTtsModel(modelId: string) {
  const { HFModelConfig_v1, InterfaceHF } = await import("outetts");

  // Detect WebGPU shader-f16 support for optimal quantization
  let fp16Supported = false;
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (adapter) {
      fp16Supported = adapter.features.has("shader-f16");
    }
  } catch {
    // WebGPU not available, fall back to WASM
  }

  const config = new HFModelConfig_v1({
    model_path: modelId,
    language: "en",
    dtype: fp16Supported ? "q4f16" : "q4",
    device: "webgpu",
  });

  const ttsInterface = await InterfaceHF({ model_version: "0.2", cfg: config });
  outeTtsInterface = ttsInterface;
  currentModelId = modelId;
  currentEngine = "outetts";
}

async function synthesizeWithOuteTts(text: string, speakerId?: string) {
  if (!outeTtsInterface) {
    throw new Error("OuteTTS model not loaded");
  }

  const speaker = speakerId && speakerId !== "random"
    ? outeTtsInterface.load_default_speaker(speakerId)
    : null;

  const output = await outeTtsInterface.generate({
    text,
    speaker,
    temperature: 0.1,
    repetition_penalty: 1.1,
    max_length: 4096,
  });

  const wavBuffer: ArrayBuffer = output.to_wav();

  self.postMessage(
    {
      type: "result",
      data: { wavBuffer },
    },
    { transfer: [wavBuffer] }
  );
}

// ─── Router ───────────────────────────────────────────────────

async function loadModel(modelId: string) {
  // Reload if model changed
  if (currentModelId !== null && currentModelId !== modelId) {
    disposeCurrentModel();
  }

  if (currentModelId === modelId) {
    return;
  }

  const engine = MODEL_ENGINE_MAP[modelId];
  if (!engine) {
    throw new Error(`Unknown TTS model: ${modelId}`);
  }

  switch (engine) {
    case "kokoro":
      await loadKokoroModel(modelId);
      break;
    case "supertonic":
      await loadSupertonicModel(modelId);
      break;
    case "lfm":
      await loadLfmModel(modelId);
      break;
    case "outetts":
      await loadOuteTtsModel(modelId);
      break;
  }
}

// ─── Message handler ──────────────────────────────────────────

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId } = event.data;
    try {
      await loadModel(modelId || DEFAULT_MODEL_ID);
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to load TTS model",
        },
      });
    }
  }

  if (type === "synthesize") {
    const { text, speakerId } = event.data;
    try {
      switch (currentEngine) {
        case "kokoro":
          await synthesizeWithKokoro(text, speakerId);
          break;
        case "supertonic":
          await synthesizeWithSupertonic(text, speakerId);
          break;
        case "lfm":
          await synthesizeWithLfm(text);
          break;
        case "outetts":
          await synthesizeWithOuteTts(text, speakerId);
          break;
        default:
          throw new Error("No TTS model loaded");
      }
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Speech synthesis failed",
        },
      });
    }
  }

  if (type === "dispose") {
    disposeCurrentModel();
  }
});
