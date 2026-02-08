import { AudioModel } from "../../lib/lfm/audio-model.js";

const DEFAULT_MODEL_ID = "LiquidAI/LFM2.5-Audio-1.5B-ONNX";

type QuantizationMode = "q4";

type QuantizationConfig = {
  decoder: QuantizationMode;
  audioEncoder: QuantizationMode;
  audioEmbedding: QuantizationMode;
  audioDetokenizer: QuantizationMode;
  vocoder: QuantizationMode;
};

const DEFAULT_QUANTIZATION: QuantizationConfig = {
  decoder: "q4",
  audioEncoder: "q4",
  audioEmbedding: "q4",
  audioDetokenizer: "q4",
  vocoder: "q4",
};

let audioModel: AudioModel | null = null;
let currentModelId: string | null = null;

function postProgress(file: string, progress: number) {
  self.postMessage({
    type: "initiate",
    data: {
      file,
      progress: 0,
      loaded: 0,
      total: 100,
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
        status: "done",
      },
    });
  }
}

function getModelBase(modelId: string) {
  return `https://huggingface.co/${modelId}/resolve/main`;
}

function ensureModelLoaded() {
  if (!audioModel) {
    throw new Error("Model not loaded");
  }

  return audioModel;
}

function disposeModel() {
  if (audioModel) {
    audioModel.dispose();
    audioModel = null;
  }

  currentModelId = null;
}

async function loadModel(modelId: string) {
  if (currentModelId === modelId && audioModel) {
    return;
  }

  disposeModel();

  const model = new AudioModel();
  await model.load(getModelBase(modelId), {
    device: "webgpu",
    quantization: DEFAULT_QUANTIZATION,
    progressCallback: (rawProgress: unknown) => {
      const progress = rawProgress as {
        file?: string;
        progress?: number;
      };

      postProgress(progress.file ?? "lfm-audio", progress.progress ?? 0);
    },
  });

  audioModel = model;
  currentModelId = modelId;
}

async function runAsr(audio: Float32Array, sampleRate: number) {
  const model = ensureModelLoaded();
  const text = await model.transcribe(audio, sampleRate, {
    onToken: (partialText: string) => {
      self.postMessage({
        type: "asr_partial",
        data: { text: partialText },
      });
    },
  });

  self.postMessage({
    type: "asr_result",
    data: { text },
  });
}

async function runTts(text: string) {
  const model = ensureModelLoaded();
  const tts = await model.generateSpeech(text, {
    maxNewTokens: 1024,
  }) as {
    audioCodes?: number[][];
    textOutput?: string;
  };

  if (!tts.audioCodes || tts.audioCodes.length === 0) {
    throw new Error("No TTS audio frames were generated");
  }

  const waveform = await model.decodeAudioCodes(tts.audioCodes);

  if (!waveform || waveform.length === 0) {
    throw new Error("Failed to decode generated TTS audio");
  }

  self.postMessage({
    type: "tts_result",
    data: {
      text: tts.textOutput ?? "",
      audio: waveform,
      samplingRate: 24000,
    },
  });
}

async function runInterleaved(
  audio: Float32Array,
  sampleRate: number,
  prompt = ""
) {
  const model = ensureModelLoaded();

  const transcript = await model.transcribe(audio, sampleRate);
  const interleaved = await model.generateInterleaved(audio, sampleRate, prompt, {
    onToken: (partialText: string) => {
      self.postMessage({
        type: "asr_partial",
        data: { text: partialText },
      });
    },
  }) as {
    text?: string;
    audioCodes?: number[][];
  };

  let outputAudio: Float32Array | null = null;

  if (interleaved.audioCodes && interleaved.audioCodes.length > 0) {
    outputAudio = await model.decodeAudioCodes(interleaved.audioCodes);
  }

  if (outputAudio && outputAudio.length > 0) {
    self.postMessage({
      type: "interleaved_result",
      data: {
        transcript,
        responseText: interleaved.text ?? "",
        audio: {
          audio: outputAudio,
          samplingRate: 24000,
        },
      },
    });
    return;
  }

  self.postMessage({
    type: "interleaved_result",
    data: {
      transcript,
      responseText: interleaved.text ?? "",
      audio: null,
    },
  });
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  try {
    if (type === "load") {
      const { modelId } = event.data;
      await loadModel(modelId || DEFAULT_MODEL_ID);
      self.postMessage({ type: "ready" });
      return;
    }

    if (type === "asr") {
      const { audio, sampleRate } = event.data;
      await runAsr(audio, sampleRate);
      return;
    }

    if (type === "tts") {
      const { text } = event.data;
      await runTts(text);
      return;
    }

    if (type === "interleaved") {
      const { audio, sampleRate, prompt } = event.data;
      await runInterleaved(audio, sampleRate, prompt);
      return;
    }

    if (type === "reset_interleaved") {
      const model = ensureModelLoaded();
      model.reset();
      self.postMessage({ type: "reset_done" });
      return;
    }

    if (type === "dispose") {
      disposeModel();
      return;
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      data: {
        mode: type,
        message:
          error instanceof Error ? error.message : "LFM audio worker operation failed",
      },
    });
  }
});
