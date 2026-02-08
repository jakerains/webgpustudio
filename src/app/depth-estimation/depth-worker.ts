import { pipeline, env, RawImage } from "@huggingface/transformers";

// Workers can't use path aliases — inline constants
const DEFAULT_DEPTH_MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf";

env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let depthPipeline: any = null;
let currentModelId: string | null = null;

async function loadModel(
  modelId: string,
  progressCallback: (data: unknown) => void
) {
  // Dispose previous if switching
  if (depthPipeline !== null && currentModelId !== modelId) {
    try {
      await depthPipeline.dispose();
    } catch {
      // ignore disposal errors
    }
    depthPipeline = null;
    currentModelId = null;
  }

  if (depthPipeline !== null) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  depthPipeline = await (pipeline as any)("depth-estimation", modelId, {
    device: "webgpu",
    progress_callback: progressCallback,
  });

  currentModelId = modelId;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId } = event.data;
    try {
      await loadModel(modelId || DEFAULT_DEPTH_MODEL_ID, (data: unknown) => {
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
              : "Failed to load depth model",
        },
      });
    }
  }

  if (type === "estimate") {
    const { imageData } = event.data;
    try {
      if (!depthPipeline) {
        throw new Error("Model not loaded");
      }

      // Load image from base64 data URL
      const image = await RawImage.fromURL(imageData);

      // Run depth estimation
      const result = await depthPipeline(image);

      // The result contains a depth map — extract the tensor data
      const depthMap = result.depth ?? result.predicted_depth;

      // Get dimensions and pixel data from the depth map
      const width = depthMap.width;
      const height = depthMap.height;

      // Convert to regular array of normalized 0-1 float values
      const rawData = depthMap.data;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < rawData.length; i++) {
        if (rawData[i] < min) min = rawData[i];
        if (rawData[i] > max) max = rawData[i];
      }

      const range = max - min || 1;
      const normalizedData = new Float32Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        normalizedData[i] = (rawData[i] - min) / range;
      }

      self.postMessage({
        type: "result",
        data: {
          width,
          height,
          values: Array.from(normalizedData),
        },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Depth estimation failed",
        },
      });
    }
  }
});
