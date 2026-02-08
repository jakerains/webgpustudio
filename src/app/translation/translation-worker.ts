import { pipeline, env } from "@huggingface/transformers";

// Workers can't use path aliases — inline constants
const DEFAULT_MODEL_ID = "Xenova/nllb-200-distilled-600M";

env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let translator: any = null;
let currentModelId: string | null = null;

async function loadTranslator(
  modelId: string,
  progressCallback: (data: unknown) => void
) {
  if (translator !== null && currentModelId !== modelId) {
    translator = null;
    currentModelId = null;
  }

  if (translator !== null) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  translator = await (pipeline as any)("translation", modelId, {
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
      await loadTranslator(modelId, (data: unknown) => {
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
              : "Failed to load translation model",
        },
      });
    }
  }

  if (type === "translate") {
    const { text, srcLang, tgtLang } = event.data as {
      text: string;
      srcLang: string;
      tgtLang: string;
    };

    try {
      if (!translator) {
        throw new Error("Model not loaded");
      }

      const result = await translator(text, {
        src_lang: srcLang,
        tgt_lang: tgtLang,
      });

      // Result is typically [{translation_text: "..."}]
      const translatedText = Array.isArray(result)
        ? result[0]?.translation_text ?? ""
        : (result as { translation_text: string }).translation_text ?? "";

      self.postMessage({
        type: "result",
        data: { translatedText },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Translation failed",
        },
      });
    }
  }
});
