export interface TranscriberProgressItem {
  file: string;
  progress: number;
  loaded: number;
  total: number;
  name?: string;
  status?: string;
}

export interface TranscriberChunk {
  text: string;
  timestamp: [number, number | null];
}

export interface TranscriberData {
  isBusy: boolean;
  text: string;
  chunks: TranscriberChunk[];
}

export interface ModelLoadProgress {
  status: "initiate" | "download" | "progress" | "done" | "ready";
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  name?: string;
}

// Worker message types
export type WorkerIncomingMessage =
  | { type: "load"; device: "webgpu" | "wasm"; modelId: string }
  | { type: "transcribe"; audio: Float32Array };

export type WorkerOutgoingMessage =
  | { type: "initiate"; data: ModelLoadProgress }
  | { type: "progress"; data: ModelLoadProgress }
  | { type: "done"; data: ModelLoadProgress }
  | { type: "ready" }
  | { type: "update"; data: TranscriberData }
  | { type: "complete"; data: TranscriberData }
  | { type: "error"; data: { message: string } };
