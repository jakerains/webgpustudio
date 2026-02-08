import { pipeline, env } from "@huggingface/transformers";
import { AudioModel } from "../../lib/lfm/audio-model.js";

// Constants inlined -- Web Workers don't resolve path aliases
const DEFAULT_MODEL_ID = "LiquidAI/LFM2.5-Audio-1.5B-ONNX";
const LFM_MODEL_ID = "LiquidAI/LFM2.5-Audio-1.5B-ONNX";
const SPEECHT5_SPEAKER_EMBEDDINGS_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

// Disable local model check - always download from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPipeline: any = null;
let lfmModel: AudioModel | null = null;
let currentModelId: string | null = null;

function disposeCurrentModel() {
  if (lfmModel) {
    lfmModel.dispose();
    lfmModel = null;
  }

  ttsPipeline = null;
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
    const { text } = event.data;
    try {
      if (currentModelId === LFM_MODEL_ID) {
        await synthesizeWithLfm(text);
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
