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
    id: "briaai/RMBG-2.0",
    label: "RMBG 2.0",
    size: "~200 MB",
    description: "Higher quality, more accurate edges",
  },
];

export const DEFAULT_BG_REMOVAL_MODEL_ID = BG_REMOVAL_MODELS[0].id;
