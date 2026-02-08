import {
  SamModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";

// Workers can't use path aliases — inline constants
// SAM3 models use Sam3TrackerModel, SAM1 models use SamModel
const SAM3_MODEL_IDS = ["onnx-community/sam3-tracker-ONNX"];

env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
let currentModelId: string | null = null;
let currentModelClass: "sam3" | "sam1" | null = null;

function isSam3(modelId: string): boolean {
  return SAM3_MODEL_IDS.some((id) => modelId.includes(id));
}

async function loadModel(
  modelId: string,
  dtype: string | undefined,
  progressCallback: (data: unknown) => void
) {
  if (model !== null && currentModelId !== modelId) {
    model = null;
    processor = null;
    currentModelId = null;
    currentModelClass = null;
  }

  if (model !== null) return;

  const useSam3 = isSam3(modelId);

  if (useSam3) {
    // Dynamic import for Sam3TrackerModel — may not exist in older transformers.js versions
    const { Sam3TrackerModel } = await import("@huggingface/transformers");
    model = await Sam3TrackerModel.from_pretrained(modelId, {
      dtype: (dtype || "q4f16") as "q4f16",
      device: "webgpu",
      progress_callback: progressCallback,
    });
  } else {
    model = await SamModel.from_pretrained(modelId, {
      device: "webgpu",
      progress_callback: progressCallback,
    });
  }

  processor = await AutoProcessor.from_pretrained(modelId, {
    progress_callback: progressCallback,
  });

  currentModelId = modelId;
  currentModelClass = useSam3 ? "sam3" : "sam1";
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
              : "Failed to load segmentation model",
        },
      });
    }
  }

  if (type === "segment") {
    const { imageData, points } = event.data as {
      imageData: string;
      points: Array<{ x: number; y: number }>;
    };

    try {
      if (!model || !processor) {
        throw new Error("Model not loaded");
      }

      const image = await RawImage.fromURL(imageData);

      if (currentModelClass === "sam3") {
        // SAM3 API: deeply nested arrays
        // input_points: [[[[x, y], ...]]]  (batch × objects × points × coords)
        // input_labels: [[[1, ...]]]        (batch × objects × labels)
        const sam3Points = points.map((p) => [p.x, p.y]);
        const sam3Labels = points.map(() => 1);

        const inputs = await processor(image, {
          input_points: [[sam3Points]],
          input_labels: [[sam3Labels]],
        });

        const outputs = await model(inputs);

        const masksTensor = await processor.post_process_masks(
          outputs.pred_masks,
          inputs.original_sizes,
          inputs.reshaped_input_sizes
        );

        // Extract IoU scores if available
        let scores: number[] = [];
        if (outputs.iou_scores) {
          const scoreData = outputs.iou_scores.data as Float32Array;
          scores = Array.from(scoreData);
        }

        // SAM3 masksTensor: [batch][object] → Tensor with dims [1, numMasks, H, W]
        const masks: Array<{ data: number[]; width: number; height: number }> =
          [];
        const batchMasks = masksTensor[0];

        if (batchMasks && batchMasks[0]) {
          const maskTensor = batchMasks[0];
          const dims = maskTensor.dims; // [1, numMasks, H, W]
          const numMasks = dims.length === 4 ? dims[1] : 1;
          const maskH = dims[dims.length - 2];
          const maskW = dims[dims.length - 1];
          const rawData = maskTensor.data as Uint8Array | Float32Array;

          for (let i = 0; i < numMasks; i++) {
            const offset = i * maskH * maskW;
            const slice = Array.from(rawData.slice(offset, offset + maskH * maskW));
            masks.push({
              data: slice.map((v) => (v > 0 ? 1 : 0)),
              width: maskW,
              height: maskH,
            });
          }
        }

        // Pick the best mask by IoU score, or return all if no scores
        if (scores.length > 0 && masks.length > 0) {
          let bestIdx = 0;
          for (let i = 1; i < scores.length && i < masks.length; i++) {
            if (scores[i] > scores[bestIdx]) bestIdx = i;
          }
          self.postMessage({
            type: "result",
            data: {
              masks: [masks[bestIdx]],
              scores: [scores[bestIdx]],
              allMasks: masks,
              allScores: scores,
            },
          });
        } else {
          self.postMessage({
            type: "result",
            data: { masks, scores: [], allMasks: masks, allScores: [] },
          });
        }
      } else {
        // SAM1 API: flat arrays
        const inputPoints = points.map((p) => [p.x, p.y]);
        const inputLabels = points.map(() => 1);

        const inputs = await processor(image, {
          input_points: [inputPoints],
          input_labels: [inputLabels],
        });

        const outputs = await model(inputs);

        const masksTensor = await processor.post_process_masks(
          outputs.pred_masks,
          inputs.original_sizes,
          inputs.reshaped_input_sizes
        );

        const masks: Array<{ data: number[]; width: number; height: number }> =
          [];
        const batchMasks = masksTensor[0];
        for (let i = 0; i < batchMasks.length; i++) {
          const mask = batchMasks[i];
          const maskData = Array.from(mask.data as Float32Array);
          masks.push({
            data: maskData,
            width: mask.dims[mask.dims.length - 1],
            height: mask.dims[mask.dims.length - 2],
          });
        }

        self.postMessage({
          type: "result",
          data: { masks, scores: [], allMasks: masks, allScores: [] },
        });
      }
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Segmentation failed",
        },
      });
    }
  }
});
