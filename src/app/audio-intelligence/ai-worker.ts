import {
  VoxtralForConditionalGeneration,
  VoxtralProcessor,
  TextStreamer,
  env,
} from "@huggingface/transformers";

// Disable local model check — always download from HF Hub
env.allowLocalModels = false;
// Ensure browser Cache API is used
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
let currentModelId: string | null = null;
let aborted = false;

async function loadModel(
  modelId: string,
  dtype: Record<string, string>,
  progressCallback: (data: unknown) => void
) {
  // Dispose previous model if switching
  if (model !== null && currentModelId !== modelId) {
    try {
      await model.dispose();
    } catch {
      // ignore disposal errors
    }
    model = null;
    processor = null;
    currentModelId = null;
  }

  if (model !== null) return;

  processor = await VoxtralProcessor.from_pretrained(modelId, {
    progress_callback: progressCallback,
  });

  model = await VoxtralForConditionalGeneration.from_pretrained(modelId, {
    dtype: dtype as Record<string, "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16" | "auto">,
    device: "webgpu",
    progress_callback: progressCallback,
  });

  currentModelId = modelId;
}

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
              : "Failed to load audio intelligence model",
        },
      });
    }
  }

  if (type === "generate") {
    // audioData is a pre-decoded Float32Array (16kHz mono) from the main thread
    const { audioData, prompt, maxTokens } = event.data;
    aborted = false;

    try {
      if (!processor || !model) {
        throw new Error("Model not loaded");
      }

      // Build multimodal conversation — audio marker tells the template
      // where to insert the <|audio|> special token
      const conversation = [
        {
          role: "user",
          content: [
            { type: "audio" },
            { type: "text", text: prompt },
          ],
        },
      ];

      // Apply chat template to get the formatted text string
      const text = processor.apply_chat_template(conversation, {
        tokenize: false,
        add_generation_prompt: true,
      });

      // audioData is already a Float32Array at 16kHz — decoded on the main thread
      // because Web Workers don't have AudioContext
      const inputs = await processor(text, audioData);

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
        do_sample: false,
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
                : "Generation failed",
          },
        });
      }
    }
  }

  if (type === "abort") {
    aborted = true;
  }
});
