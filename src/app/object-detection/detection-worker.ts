import { pipeline, env } from "@huggingface/transformers";

// Disable local model check — always download from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

// Inlined constant — workers can't use path aliases
const DEFAULT_MODEL_ID = "Xenova/yolos-tiny";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let detector: any = null;
let currentModelId: string | null = null;

class DetectionPipeline {
  static async getInstance(
    modelId: string = DEFAULT_MODEL_ID,
    progressCallback?: (data: unknown) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    // Reload if model changed
    if (detector !== null && currentModelId !== modelId) {
      detector = null;
      currentModelId = null;
    }

    if (detector === null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detector = await (pipeline as any)("object-detection", modelId, {
        device: "webgpu",
        progress_callback: progressCallback,
      });
      currentModelId = modelId;
    }

    return detector;
  }
}

// Listen for messages from main thread
self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId } = event.data;
    try {
      await DetectionPipeline.getInstance(modelId, (data: unknown) => {
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
              : "Failed to load detection model",
        },
      });
    }
  }

  if (type === "detect") {
    const { imageData, threshold } = event.data;
    try {
      const det = await DetectionPipeline.getInstance();
      if (!det) {
        throw new Error("Model not loaded");
      }

      const result = await det(imageData, {
        threshold: threshold ?? 0.5,
        percentage: true,
      });

      // Normalize results — pipeline may return array of {label, score, box}
      const boxes = (result as Array<{
        label: string;
        score: number;
        box: { xmin: number; ymin: number; xmax: number; ymax: number };
      }>).map((item) => ({
        label: item.label,
        score: item.score,
        box: item.box,
      }));

      self.postMessage({
        type: "result",
        data: { boxes },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Detection failed",
        },
      });
    }
  }
});
