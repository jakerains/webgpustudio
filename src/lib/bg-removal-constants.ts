export interface BgRemovalModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const BG_REMOVAL_MODELS: BgRemovalModelOption[] = [
  {
    id: "briaai/RMBG-1.4",
    label: "RMBG 1.4",
    size: "~44 MB",
    description: "Fast, lightweight background removal",
  },
  {
    id: "Xenova/modnet",
    label: "MODNet",
    size: "~25 MB",
    description: "Tiny portrait background removal",
  },
];

export const DEFAULT_BG_REMOVAL_MODEL_ID = BG_REMOVAL_MODELS[0].id;
