import { pipeline, env } from "@huggingface/transformers";

// Constants inlined -- Web Workers don't resolve path aliases
const DEFAULT_MODEL_ID = "Xenova/musicgen-small";

// Disable local model check - always download from HF Hub
env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let musicPipeline: any = null;
let currentModelId: string | null = null;

async function loadModel(
  modelId: string,
  progressCallback: (data: unknown) => void
) {
  // Reload if model changed
  if (musicPipeline !== null && currentModelId !== modelId) {
    musicPipeline = null;
    currentModelId = null;
  }

  if (musicPipeline !== null) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  musicPipeline = await (pipeline as any)("text-to-audio", modelId, {
    device: "webgpu",
    progress_callback: progressCallback,
  });

  currentModelId = modelId;
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
              : "Failed to load music model",
        },
      });
    }
  }

  if (type === "generate") {
    const { prompt, maxLength } = event.data;
    try {
      if (!musicPipeline) {
        throw new Error("Model not loaded");
      }

      self.postMessage({ type: "generating" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (musicPipeline as any)(prompt, {
        max_new_tokens: maxLength || 500,
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
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Music generation failed",
        },
      });
    }
  }
});
