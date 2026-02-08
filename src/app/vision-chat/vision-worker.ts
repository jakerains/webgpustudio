import {
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  RawImage,
  env,
} from "@huggingface/transformers";

// Disable local model check - always download from HF Hub
env.allowLocalModels = false;
// Ensure browser Cache API is used
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
let currentModelId: string | null = null;
let currentDtype: string | null = null;
let aborted = false;

async function loadModel(
  modelId: string,
  dtype: string,
  progressCallback: (data: unknown) => void
) {
  // Dispose previous model if switching
  if (model !== null && (currentModelId !== modelId || currentDtype !== dtype)) {
    try {
      await model.dispose();
    } catch {
      // ignore disposal errors
    }
    model = null;
    processor = null;
    currentModelId = null;
    currentDtype = null;
  }

  if (model !== null) return;

  processor = await AutoProcessor.from_pretrained(modelId, {
    progress_callback: progressCallback,
  });

  model = await AutoModelForVision2Seq.from_pretrained(modelId, {
    dtype: dtype as "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16" | "auto",
    device: "webgpu",
    progress_callback: progressCallback,
  });

  currentModelId = modelId;
  currentDtype = dtype;
}

// Listen for messages from main thread
self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId, dtype } = event.data;
    try {
      await loadModel(modelId, dtype, (data: unknown) => {
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
              : "Failed to load vision model",
        },
      });
    }
  }

  if (type === "generate") {
    const { imageData, messages, maxTokens } = event.data;
    aborted = false;

    try {
      if (!processor || !model) {
        throw new Error("Model not loaded");
      }

      // Load image from base64 data URL
      const image = await RawImage.fromURL(imageData);

      // Build conversation messages for the processor
      // SmolVLM expects messages with image content
      const conversationMessages = messages.map(
        (m: { role: string; content: string; hasImage?: boolean }) => {
          if (m.role === "user" && m.hasImage) {
            return {
              role: "user",
              content: [
                { type: "image" as const },
                { type: "text" as const, text: m.content },
              ],
            };
          }
          return {
            role: m.role,
            content: [{ type: "text" as const, text: m.content }],
          };
        }
      );

      // Apply chat template to get text prompt
      const text = processor.apply_chat_template(conversationMessages, {
        add_generation_prompt: true,
      });

      // Process inputs with image
      const inputs = await processor(text, [image], {
        // Explicitly pass to handle image sizing
      });

      let fullContent = "";

      // Create a text streamer for token-by-token output
      const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token: string) => {
          if (aborted) return;
          fullContent += token;
          self.postMessage({
            type: "token",
            data: { token },
          });
        },
      });

      // Generate with streaming
      await model.generate({
        ...inputs,
        max_new_tokens: maxTokens,
        do_sample: true,
        temperature: 0.7,
        top_p: 0.9,
        streamer,
      });

      if (!aborted) {
        self.postMessage({
          type: "complete",
          data: { content: fullContent },
        });
      }
    } catch (error) {
      if (!aborted) {
        self.postMessage({
          type: "error",
          data: {
            message:
              error instanceof Error
                ? error.message
                : "Vision generation failed",
          },
        });
      }
    }
  }

  if (type === "abort") {
    aborted = true;
  }
});
