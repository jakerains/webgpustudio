/**
 * Checks if a HuggingFace model has been cached in the browser's Cache API.
 *
 * @huggingface/transformers stores downloaded files via the Cache API under
 * their full HuggingFace Hub URLs (e.g. https://huggingface.co/{model_id}/resolve/main/{file}).
 * We probe for config.json which every model has — if it's cached, the rest
 * of the model files almost certainly are too.
 */
export async function isModelCached(modelId: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;

  try {
    // The library caches under the full HF URL for each file.
    // config.json is always the first file fetched for any model.
    const testUrl = `https://huggingface.co/${modelId}/resolve/main/config.json`;
    const match = await caches.match(testUrl);
    return match !== undefined;
  } catch {
    return false;
  }
}

/**
 * Checks cache status for multiple models at once.
 * Returns a Set of model IDs that are cached.
 */
export async function getCachedModelIds(
  modelIds: string[]
): Promise<Set<string>> {
  const cached = new Set<string>();
  const checks = modelIds.map(async (id) => {
    if (await isModelCached(id)) {
      cached.add(id);
    }
  });
  await Promise.all(checks);
  return cached;
}

/**
 * Deletes all Cache API caches used by @huggingface/transformers.
 * The library creates caches named "transformers-cache" (or similar).
 * We delete all caches to be thorough — the browser will recreate them on next download.
 */
export async function clearAllModelCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

/**
 * Estimates total cache storage used by model files.
 * Returns size in bytes.
 */
export async function estimateCacheSize(): Promise<number> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return 0;
  try {
    const estimate = await navigator.storage.estimate();
    return estimate.usage ?? 0;
  } catch {
    return 0;
  }
}
