import { pipeline, env, FeatureExtractionPipeline } from "@huggingface/transformers";

// Workers can't use path aliases — inline constants
const DEFAULT_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

env.allowLocalModels = false;

class EmbeddingPipeline {
  static instance: FeatureExtractionPipeline | null = null;
  static currentModelId: string | null = null;

  static async getInstance(
    modelId: string = DEFAULT_MODEL_ID,
    progressCallback?: (data: unknown) => void
  ): Promise<FeatureExtractionPipeline> {
    if (this.instance !== null && this.currentModelId !== modelId) {
      this.instance = null;
      this.currentModelId = null;
    }
    if (this.instance === null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.instance = (await (pipeline as any)(
        "feature-extraction",
        modelId,
        {
          device: "webgpu",
          progress_callback: progressCallback,
        }
      )) as FeatureExtractionPipeline;
      this.currentModelId = modelId;
    }
    return this.instance;
  }
}

// Document store
let documentTexts: string[] = [];
let documentEmbeddings: number[][] = [];

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function getEmbedding(extractor: FeatureExtractionPipeline, text: string): Promise<number[]> {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  // output is a Tensor — convert to plain array
  return Array.from(output.data as Float32Array);
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const { modelId } = event.data;
    try {
      await EmbeddingPipeline.getInstance(modelId, (data: unknown) => {
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
              : "Failed to load search model",
        },
      });
    }
  }

  if (type === "index") {
    const { documents } = event.data as { documents: string[] };
    try {
      const extractor = await EmbeddingPipeline.getInstance();
      documentTexts = documents;
      documentEmbeddings = [];

      for (const doc of documents) {
        const embedding = await getEmbedding(extractor, doc);
        documentEmbeddings.push(embedding);
      }

      self.postMessage({
        type: "indexed",
        data: { count: documentEmbeddings.length },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Indexing failed",
        },
      });
    }
  }

  if (type === "search") {
    const { query, topK } = event.data as { query: string; topK: number };
    try {
      const extractor = await EmbeddingPipeline.getInstance();
      const queryEmbedding = await getEmbedding(extractor, query);

      const scores = documentEmbeddings.map((docEmb, index) => ({
        text: documentTexts[index],
        score: cosineSimilarity(queryEmbedding, docEmb),
        index,
      }));

      scores.sort((a, b) => b.score - a.score);
      const results = scores.slice(0, topK);

      self.postMessage({
        type: "results",
        data: { results },
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Search failed",
        },
      });
    }
  }
});
