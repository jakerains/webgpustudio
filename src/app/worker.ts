import {
  AutomaticSpeechRecognitionPipeline,
  pipeline,
  env,
} from "@huggingface/transformers";
// Constants inlined — Web Workers don't resolve path aliases
const DEFAULT_MODEL_ID = "onnx-community/whisper-tiny.en";
const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;

// Disable local model check - we always download from HF Hub
env.allowLocalModels = false;

class WhisperPipeline {
  static instance: AutomaticSpeechRecognitionPipeline | null = null;
  static currentModelId: string | null = null;

  static async getInstance(
    device: "webgpu" | "wasm",
    modelId: string = DEFAULT_MODEL_ID,
    progressCallback?: (data: unknown) => void
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    // Reload if model changed
    if (this.instance !== null && this.currentModelId !== modelId) {
      this.instance = null;
      this.currentModelId = null;
    }
    if (this.instance === null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.instance = (await (pipeline as any)(
        "automatic-speech-recognition",
        modelId,
        {
          device,
          dtype: {
            encoder_model: "fp32",
            decoder_model_merged: device === "webgpu" ? "fp32" : "q8",
          },
          progress_callback: progressCallback,
        }
      )) as AutomaticSpeechRecognitionPipeline;
      this.currentModelId = modelId;
    }
    return this.instance;
  }
}

// Listen for messages from main thread
self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { device, modelId } = event.data;
    try {
      await WhisperPipeline.getInstance(device, modelId, (data: unknown) => {
        const progressData = data as Record<string, unknown>;
        // Forward model loading progress to main thread
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
              : "Failed to load Whisper model",
        },
      });
    }
  }

  if (type === "transcribe") {
    const { audio } = event.data;
    try {
      const transcriber = await WhisperPipeline.getInstance("webgpu");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (transcriber as any)(audio, {
        top_k: 0,
        do_sample: false,
        chunk_length_s: CHUNK_LENGTH_S,
        stride_length_s: STRIDE_LENGTH_S,
        return_timestamps: true,
        force_full_sequences: false,
        callback_function: (beams: unknown) => {
          const beamData = beams as { output_token_ids?: { length: number }[] };
          if (beamData.output_token_ids) {
            self.postMessage({
              type: "update",
              data: {
                isBusy: true,
                text: "",
                chunks: [],
              },
            });
          }
        },
      });

      // Handle result - could be single or array of chunks
      const output = result as {
        text: string;
        chunks?: Array<{
          text: string;
          timestamp: [number, number | null];
        }>;
      };

      self.postMessage({
        type: "complete",
        data: {
          isBusy: false,
          text: output.text || "",
          chunks: output.chunks || [{ text: output.text || "", timestamp: [0, null] }],
        },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Transcription failed",
        },
      });
    }
  }
});
