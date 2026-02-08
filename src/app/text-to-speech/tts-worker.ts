import { pipeline, env } from "@huggingface/transformers";
import { AudioModel } from "../../lib/lfm/audio-model.js";

// Constants inlined -- Web Workers don't resolve path aliases
const DEFAULT_MODEL_ID = "LiquidAI/LFM2.5-Audio-1.5B-ONNX";
const LFM_MODEL_ID = "LiquidAI/LFM2.5-Audio-1.5B-ONNX";
const OUTETTS_MODEL_ID = "onnx-community/OuteTTS-0.2-500M";
const SPEECHT5_SPEAKER_EMBEDDINGS_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

// Disable local model check - always download from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPipeline: any = null;
let lfmModel: AudioModel | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let outeTtsInterface: any = null;
let currentModelId: string | null = null;

function disposeCurrentModel() {
  if (lfmModel) {
    lfmModel.dispose();
    lfmModel = null;
  }

  ttsPipeline = null;
  outeTtsInterface = null;
  currentModelId = null;
}

function postLfmProgress(file: string, progress: number) {
  self.postMessage({
    type: "initiate",
    data: {
      file,
      progress: 0,
      loaded: 0,
      total: 100,
      name: file,
      status: "initiate",
    },
  });

  self.postMessage({
    type: "progress",
    data: {
      file,
      progress,
      loaded: progress,
      total: 100,
      name: file,
      status: "progress",
    },
  });

  if (progress >= 100) {
    self.postMessage({
      type: "done",
      data: {
        file,
        progress: 100,
        loaded: 100,
        total: 100,
        name: file,
        status: "done",
      },
    });
  }
}

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

      postLfmProgress(data.file ?? "lfm-model", data.progress ?? 0);
    },
  });

  lfmModel = model;
  currentModelId = modelId;
}

async function loadSpeecht5Model(
  modelId: string,
  progressCallback: (data: unknown) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ttsPipeline = await (pipeline as any)("text-to-speech", modelId, {
    device: "webgpu",
    progress_callback: progressCallback,
  });

  currentModelId = modelId;
}

async function loadOuteTtsModel(modelId: string) {
  // Dynamic import — only load outetts when actually needed
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
}

async function loadModel(
  modelId: string,
  progressCallback: (data: unknown) => void
) {
  // Reload if model changed
  if (currentModelId !== null && currentModelId !== modelId) {
    disposeCurrentModel();
  }

  if (currentModelId === modelId) {
    return;
  }

  if (modelId === LFM_MODEL_ID) {
    await loadLfmModel(modelId);
    return;
  }

  if (modelId === OUTETTS_MODEL_ID) {
    await loadOuteTtsModel(modelId);
    return;
  }

  await loadSpeecht5Model(modelId, progressCallback);
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

async function synthesizeWithOuteTts(text: string, speakerId?: string) {
  if (!outeTtsInterface) {
    throw new Error("OuteTTS model not loaded");
  }

  // Load speaker profile: null = random voice
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
    // Transfer the ArrayBuffer instead of copying
    { transfer: [wavBuffer] }
  );
}

async function synthesizeWithSpeecht5(text: string) {
  if (!ttsPipeline) {
    throw new Error("SpeechT5 model not loaded");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (ttsPipeline as any)(text, {
    speaker_embeddings: SPEECHT5_SPEAKER_EMBEDDINGS_URL,
  });

  const output = result as {
    audio: Float32Array;
    sampling_rate: number;
  };

  self.postMessage({
    type: "result",
    data: {
      audio: output.audio,
      samplingRate: output.sampling_rate,
    },
  });
}

// Listen for messages from main thread
self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId } = event.data;
    try {
      await loadModel(modelId || DEFAULT_MODEL_ID, (data: unknown) => {
        const progressData = data as Record<string, unknown>;
        self.postMessage({
          type: progressData.status,
          data: progressData,
        });
      });
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
      if (currentModelId === LFM_MODEL_ID) {
        await synthesizeWithLfm(text);
      } else if (currentModelId === OUTETTS_MODEL_ID) {
        await synthesizeWithOuteTts(text, speakerId);
      } else {
        await synthesizeWithSpeecht5(text);
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
