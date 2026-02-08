export interface DepthModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const DEPTH_MODELS: DepthModelOption[] = [
  {
    id: "depth-anything/Depth-Anything-V2-Small-hf",
    label: "Depth Anything V2 Small",
    size: "~97 MB",
    description: "Fast, accurate monocular depth estimation",
  },
];

export const DEFAULT_DEPTH_MODEL_ID = DEPTH_MODELS[0].id;
