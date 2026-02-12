import {
  pipeline,
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";

// Disable local model check — always download from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

// Inlined constants — workers can't use path aliases
const DEFAULT_MODEL_ID = "onnx-community/yolov10n";
const DEFAULT_PIPELINE_TYPE = "yolov10";

// COCO 80-class labels (YOLOv10 output classId → label)
const COCO_LABELS = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
  "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
  "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
  "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
  "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
  "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush",
];

// Singleton state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentInstance: any = null;
let currentModelId: string | null = null;
let currentPipelineType: string | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentProcessor: any = null; // only used for yolov10

/**
 * Load or return cached model instance.
 * Handles all three pipeline types.
 */
async function loadModel(
  modelId: string = DEFAULT_MODEL_ID,
  pipelineType: string = DEFAULT_PIPELINE_TYPE,
  progressCallback?: (data: unknown) => void
) {
  // Reload if model or pipeline type changed
  if (
    currentInstance !== null &&
    (currentModelId !== modelId || currentPipelineType !== pipelineType)
  ) {
    currentInstance = null;
    currentProcessor = null;
    currentModelId = null;
    currentPipelineType = null;
  }

  if (currentInstance !== null) {
    return { model: currentInstance, processor: currentProcessor };
  }

  if (pipelineType === "yolov10") {
    // YOLOv10: use AutoModel + AutoProcessor
    const [model, processor] = await Promise.all([
      AutoModel.from_pretrained(modelId, {
        device: "webgpu",
        progress_callback: progressCallback,
      }),
      AutoProcessor.from_pretrained(modelId, {
        progress_callback: progressCallback,
      }),
    ]);
    currentInstance = model;
    currentProcessor = processor;
  } else if (pipelineType === "zero-shot-object-detection") {
    // Grounding DINO: zero-shot-object-detection pipeline
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentInstance = await (pipeline as any)(
      "zero-shot-object-detection",
      modelId,
      {
        device: "webgpu",
        progress_callback: progressCallback,
      }
    );
  } else {
    // Standard object-detection pipeline (YOLOS / DETR)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentInstance = await (pipeline as any)("object-detection", modelId, {
      device: "webgpu",
      progress_callback: progressCallback,
    });
  }

  currentModelId = modelId;
  currentPipelineType = pipelineType;
  return { model: currentInstance, processor: currentProcessor };
}

/**
 * Run YOLOv10 inference with manual tensor post-processing.
 */
async function detectYolov10(
  imageData: string,
  threshold: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processor: any
) {
  const image = await RawImage.fromURL(imageData);
  const { pixel_values, reshaped_input_sizes } = await processor(image);
  const { output0 } = await model({ images: pixel_values });

  // output0 shape: [1, num_detections, 6] where each row = [x1, y1, x2, y2, score, classId]
  const rawData = output0.data as Float32Array;
  const numDetections = output0.dims[1];
  const stride = output0.dims[2]; // 6

  // Get the original → resized scale factors
  const [resizedH, resizedW] = reshaped_input_sizes[0];
  const origW = image.width;
  const origH = image.height;

  const boxes: {
    label: string;
    score: number;
    box: { xmin: number; ymin: number; xmax: number; ymax: number };
  }[] = [];

  for (let i = 0; i < numDetections; i++) {
    const offset = i * stride;
    const x1 = rawData[offset];
    const y1 = rawData[offset + 1];
    const x2 = rawData[offset + 2];
    const y2 = rawData[offset + 3];
    const score = rawData[offset + 4];
    const classId = Math.round(rawData[offset + 5]);

    if (score < threshold) continue;

    // Scale from resized coords back to original image coords, then to 0-1 fractions
    const scaleX = origW / resizedW;
    const scaleY = origH / resizedH;

    boxes.push({
      label: COCO_LABELS[classId] ?? `class_${classId}`,
      score,
      box: {
        xmin: (x1 * scaleX) / origW,
        ymin: (y1 * scaleY) / origH,
        xmax: (x2 * scaleX) / origW,
        ymax: (y2 * scaleY) / origH,
      },
    });
  }

  return boxes;
}

/**
 * Run Grounding DINO zero-shot detection.
 */
async function detectGroundingDino(
  imageData: string,
  threshold: number,
  candidateLabels: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detector: any
) {
  // Split user's comma-separated labels and format for Grounding DINO
  const labels = candidateLabels
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0);

  if (labels.length === 0) {
    return [];
  }

  // Grounding DINO expects labels ending with a period
  const formattedLabels = labels.map((l) =>
    l.endsWith(".") ? l : `${l}.`
  );

  const image = await RawImage.fromURL(imageData);

  const result = await detector(image, formattedLabels, {
    threshold,
  });

  // Result is array of { label, score, box: { xmin, ymin, xmax, ymax } }
  // Box coords may be absolute pixels — normalize to percentages
  const boxes = (
    result as Array<{
      label: string;
      score: number;
      box: { xmin: number; ymin: number; xmax: number; ymax: number };
    }>
  ).map((item) => {
    const b = item.box;
    // If values look like absolute pixels (> 1), convert to percentages
    const isAbsolute =
      b.xmax > 1.01 || b.ymax > 1.01;

    return {
      label: item.label.replace(/\.$/, ""), // strip trailing period
      score: item.score,
      box: isAbsolute
        ? {
            xmin: b.xmin / image.width,
            ymin: b.ymin / image.height,
            xmax: b.xmax / image.width,
            ymax: b.ymax / image.height,
          }
        : {
            xmin: b.xmin,
            ymin: b.ymin,
            xmax: b.xmax,
            ymax: b.ymax,
          },
    };
  });

  // Filter to only labels the user actually requested (the pipeline may
  // return stale labels from a cached text encoding).
  const allowedLabels = new Set(labels);
  return boxes.filter((b) => allowedLabels.has(b.label.toLowerCase()));
}

/**
 * Run standard pipeline detection (YOLOS / DETR).
 */
async function detectStandard(
  imageData: string,
  threshold: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detector: any
) {
  const result = await detector(imageData, {
    threshold,
    percentage: true,
  });

  return (
    result as Array<{
      label: string;
      score: number;
      box: { xmin: number; ymin: number; xmax: number; ymax: number };
    }>
  ).map((item) => ({
    label: item.label,
    score: item.score,
    box: item.box,
  }));
}

// Listen for messages from main thread
self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId, pipelineType } = event.data;
    try {
      await loadModel(modelId, pipelineType, (data: unknown) => {
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
    const { imageData, threshold, candidateLabels } = event.data;
    try {
      const { model, processor } = await loadModel();

      if (!model) {
        throw new Error("Model not loaded");
      }

      let boxes;

      if (currentPipelineType === "yolov10") {
        boxes = await detectYolov10(imageData, threshold ?? 0.5, model, processor);
      } else if (currentPipelineType === "zero-shot-object-detection") {
        boxes = await detectGroundingDino(
          imageData,
          threshold ?? 0.3,
          candidateLabels ?? "person, car, dog",
          model
        );
      } else {
        boxes = await detectStandard(imageData, threshold ?? 0.5, model);
      }

      self.postMessage({
        type: "result",
        data: { boxes },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error ? error.message : "Detection failed",
        },
      });
    }
  }
});
