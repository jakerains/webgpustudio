import {
  AutoModel,
  AutoProcessor,
  env,
  RawImage,
} from "@huggingface/transformers";

// Disable local model check - always download from HF Hub
env.allowLocalModels = false;

// Inlined default (workers can't use @/ path aliases)
const DEFAULT_MODEL_ID = "briaai/RMBG-1.4";

class BgRemovalPipeline {
  static model: ReturnType<typeof AutoModel.from_pretrained> | null = null;
  static processor: ReturnType<typeof AutoProcessor.from_pretrained> | null = null;
  static currentModelId: string | null = null;

  static async getInstance(
    modelId: string = DEFAULT_MODEL_ID,
    progressCallback?: (data: unknown) => void
  ) {
    // Reload if model changed
    if (this.model !== null && this.currentModelId !== modelId) {
      this.model = null;
      this.processor = null;
      this.currentModelId = null;
    }

    if (this.model === null) {
      this.model = AutoModel.from_pretrained(modelId, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        device: "webgpu" as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dtype: "fp32" as any,
        progress_callback: progressCallback,
      });
    }

    if (this.processor === null) {
      this.processor = AutoProcessor.from_pretrained(modelId);
    }

    this.currentModelId = modelId;
    return {
      model: await this.model,
      processor: await this.processor,
    };
  }
}

// Listen for messages from main thread
self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId } = event.data;
    try {
      await BgRemovalPipeline.getInstance(modelId, (data: unknown) => {
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
              : "Failed to load background removal model",
        },
      });
    }
  }

  if (type === "process") {
    const { imageData } = event.data;
    try {
      const { model, processor } = await BgRemovalPipeline.getInstance();

      // Load the image from base64 data URL
      const image = await RawImage.fromURL(imageData);

      // Process the image through the model
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { pixel_values } = await (processor as any)(image);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { output } = await (model as any)({ input: pixel_values });

      // Get the mask from the output
      // The output is a tensor — resize to original image dimensions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maskData = await RawImage.fromTensor((output as any)[0].mul(255).to("uint8")).resize(
        image.width,
        image.height
      );

      // Create an RGBA image with the mask applied
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d")!;

      // Draw the original image
      const imageBlob = await (await fetch(imageData)).blob();
      const imageBitmap = await createImageBitmap(imageBlob);
      ctx.drawImage(imageBitmap, 0, 0);

      // Get the image data and apply the mask as alpha
      const outputImageData = ctx.getImageData(0, 0, image.width, image.height);
      const pixels = outputImageData.data;

      for (let i = 0; i < maskData.data.length; i++) {
        pixels[i * 4 + 3] = maskData.data[i]; // Set alpha channel from mask
      }

      ctx.putImageData(outputImageData, 0, 0);

      // Convert to blob then to base64 data URL
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const resultDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      self.postMessage({
        type: "result",
        data: {
          imageUrl: resultDataUrl,
          width: image.width,
          height: image.height,
        },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Background removal failed",
        },
      });
    }
  }
});
