export interface SearchModelOption {
  id: string;
  label: string;
  size: string;
  description: string;
}

export const SEARCH_MODELS: SearchModelOption[] = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    label: "MiniLM L6 v2",
    size: "~25 MB",
    description: "Fast sentence embeddings, great for search",
  },
];

export const DEFAULT_SEARCH_MODEL_ID = SEARCH_MODELS[0].id;
