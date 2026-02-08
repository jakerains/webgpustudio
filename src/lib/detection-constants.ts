export interface DetectionModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const DETECTION_MODELS: DetectionModelOption[] = [
  {
    id: "Xenova/yolos-tiny",
    label: "YOLOS Tiny",
    size: "~29 MB",
    description: "Fastest, good for real-time",
  },
  {
    id: "Xenova/detr-resnet-50",
    label: "DETR ResNet-50",
    size: "~166 MB",
    description: "Higher accuracy, 91 object classes",
  },
];

export const DEFAULT_DETECTION_MODEL_ID = DETECTION_MODELS[0].id;
