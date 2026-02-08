/**
 * LFM2-Audio Model Runner for ONNX Runtime Web
 *
 * Runs audio model inference using ONNX models:
 * 1. decoder.onnx - LFM2 backbone (shared with text)
 * 2. audio_encoder.onnx - Conformer encoder for ASR (mel → embeddings)
 * 3. audio_embedding.onnx - Audio code embeddings for TTS
 * 4. audio_detokenizer.onnx - Audio codes → STFT features
 * 5. vocoder_depthformer.onnx - Autoregressive codebook prediction
 *
 * Supports ASR mode for the webapp (transcription).
 */

import * as ort from 'onnxruntime-web';
import { AutoTokenizer, env } from '@huggingface/transformers';
import { loadMelConfig, computeMelSpectrogram, loadAudioFile } from './audio-processor.js';

// Cache configuration
const CACHE_NAME = 'onnx-models-v1';
const IDB_NAME = 'onnx-model-cache';
const IDB_STORE = 'models';

// IndexedDB helpers for fallback caching
let idbPromise = null;

function openIDB() {
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });

  return idbPromise;
}

async function idbGet(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (e) {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const request = store.put(value, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    // Ignore cache write failures
  }
}

// Special tokens for audio model
const SPECIAL_TOKENS = {
  AUDIO_START: 128,  // <|audio_start|>
  TEXT_START: 129,   // <|text_start|>
  TEXT_END: 130,     // <|text_end|>
  MIXED_START: 131,  // <|mixed_start|>
  MIXED_END: 132,    // <|mixed_end|>
  IM_END: 7,         // <|im_end|>
};

// Audio codebook constants
const NUM_CODEBOOKS = 8;
const CODEBOOK_VOCAB = 2049;
const END_OF_AUDIO_TOKEN = 2048;

// Default system prompts (matching Python lfm2-audio-infer)
const DEFAULT_SYSTEM_PROMPT_ASR = 'Perform ASR.';
const DEFAULT_SYSTEM_PROMPT_TTS = 'Perform TTS. Use the UK female voice.';
const DEFAULT_SYSTEM_PROMPT_INTERLEAVED = 'Respond with interleaved text and audio.';

// Max tokens defaults (matching liquid-audio)
// Each audio frame = 80ms (6x upsampling in detokenizer, 320 hop, 24kHz)
// 1024 frames ≈ 82 seconds of audio
const DEFAULT_MAX_TOKENS_AUDIO = 1024;  // TTS and interleaved modes
const DEFAULT_MAX_TOKENS_TEXT = 100;    // ASR mode

// Timestamped logging helper
let _logStartTime = null;
function log(...args) {
  if (_logStartTime === null) {
    _logStartTime = performance.now();
  }
  const elapsed = ((performance.now() - _logStartTime) / 1000).toFixed(2);
  console.log(`[${elapsed}s]`, ...args);
}
function logReset() {
  _logStartTime = performance.now();
}

/**
 * Fetch with caching support using Cache API or IndexedDB fallback
 */
async function fetchWithCache(url, options = {}) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return fetch(url, options);
  }

  const fileName = url.split('/').pop();

  // Try Cache API first
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        console.log(`[Cache HIT] ${fileName}`);
        return cached;
      }

      console.log(`[Cache MISS] Fetching ${fileName}...`);
      const response = await fetch(url, options);

      if (response.ok) {
        cache.put(url, response.clone());
      }

      return response;
    } catch (e) {
      // Fall through to IndexedDB
    }
  }

  // Try IndexedDB fallback
  if (typeof indexedDB !== 'undefined') {
    try {
      const cached = await idbGet(url);
      if (cached) {
        console.log(`[IDB Cache HIT] ${fileName}`);
        return new Response(cached.data, {
          status: 200,
          headers: { 'Content-Type': cached.contentType || 'application/octet-stream' },
        });
      }

      console.log(`[IDB Cache MISS] Fetching ${fileName}...`);
      const response = await fetch(url, options);

      if (response.ok) {
        const clone = response.clone();
        const data = await clone.arrayBuffer();
        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        await idbSet(url, { data, contentType });
      }

      return response;
    } catch (e) {
      console.warn('IndexedDB cache failed:', e);
    }
  }

  // Direct fetch as last resort
  console.log(`[No Cache] Fetching ${fileName}...`);
  return fetch(url, options);
}

/**
 * Clear the model cache (both Cache API and IndexedDB)
 */
export async function clearModelCache() {
  let deleted = false;

  // Clear Cache API
  if (typeof caches !== 'undefined') {
    try {
      deleted = await caches.delete(CACHE_NAME);
    } catch (e) {
      // Ignore
    }
  }

  // Clear IndexedDB
  if (typeof indexedDB !== 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(IDB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
      idbPromise = null;  // Reset the cached promise
      deleted = true;
    } catch (e) {
      // Ignore
    }
  }

  console.log(deleted ? 'Model cache cleared' : 'No cache to clear');
  return deleted;
}

/**
 * Get cache storage usage info
 */
export async function getCacheInfo() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      available: estimate.quota || 0,
    };
  }
  return null;
}

/**
 * Load tokenizer from model path
 */
async function loadTokenizerFromPath(modelPath) {
  const isRemote = modelPath.startsWith('http://') || modelPath.startsWith('https://');
  console.log(`Loading tokenizer from ${isRemote ? 'remote' : 'local'}: ${modelPath}`);

  const fetchOptions = isRemote ? { mode: 'cors', credentials: 'omit' } : {};

  const [tokenizerResponse, configResponse] = await Promise.all([
    fetchWithCache(`${modelPath}/tokenizer.json`, fetchOptions),
    fetchWithCache(`${modelPath}/tokenizer_config.json`, fetchOptions),
  ]);

  if (!tokenizerResponse.ok) {
    throw new Error(`Failed to fetch tokenizer.json: ${tokenizerResponse.status}`);
  }
  if (!configResponse.ok) {
    throw new Error(`Failed to fetch tokenizer_config.json: ${configResponse.status}`);
  }

  const tokenizerJSON = await tokenizerResponse.text();
  const configJSON = await configResponse.text();

  // Parse tokenizer.json to extract special token IDs
  const tokenizerData = JSON.parse(tokenizerJSON);
  const specialTokens = {};

  if (tokenizerData.added_tokens) {
    for (const token of tokenizerData.added_tokens) {
      specialTokens[token.content] = token.id;
    }
    console.log('Found special tokens:', Object.keys(specialTokens).length);
  }

  // Create tokenizer using transformers.js
  const fakeModelId = `tokenizer-${Date.now()}`;

  const fileCache = {
    'tokenizer.json': tokenizerJSON,
    'tokenizer_config.json': configJSON,
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes(fakeModelId)) {
      for (const [filename, content] of Object.entries(fileCache)) {
        if (url.includes(filename)) {
          return new Response(content, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response('Not found', { status: 404 });
    }

    return originalFetch(input, init);
  };

  const originalAllowLocal = env.allowLocalModels;
  env.allowLocalModels = false;

  try {
    const tokenizer = await AutoTokenizer.from_pretrained(fakeModelId);
    console.log('Tokenizer created successfully');
    return { tokenizer, specialTokens };
  } finally {
    globalThis.fetch = originalFetch;
    env.allowLocalModels = originalAllowLocal;
  }
}

export class AudioModel {
  constructor() {
    this.tokenizer = null;
    this.decoderSession = null;
    this.audioEncoderSession = null;
    this.audioEmbeddingSession = null;
    this.audioEmbeddingWeight = null;  // Direct lookup (faster than ONNX)
    this.audioDetokenizerSession = null;
    this.vocoderSession = null;
    this.config = null;
    this.embedTokensWeight = null;

    // Model config
    this.hiddenSize = 2048;
    this.numLayers = 16;
    this.numKVHeads = 8;
    this.headDim = 64;
    this.convL = 3;
    this.layerTypes = [];
    this.vocabSize = 65536;

    // === Stateful cache for multi-turn conversation ===
    this.cache = null;
    this.cacheSeqLen = 0;
  }

  /**
   * Reset conversation state (KV cache).
   * Call this to start a new conversation.
   */
  reset() {
    this.cache = null;
    this.cacheSeqLen = 0;
    log('Conversation state reset');
  }

  /**
   * Load the audio model from a directory
   * @param {string} modelPath - Path to model directory
   * @param {object} options - Loading options
   */
  async load(modelPath, options = {}) {
    const { progressCallback, device = 'webgpu', quantization = null } = options;

    const report = (status, progress = 0, file = '') => {
      if (progressCallback) {
        progressCallback({ status, progress, file });
      }
    };

    const executionProviders = device === 'webgpu'
      ? ['webgpu', 'wasm']
      : ['wasm'];

    try {
      // Load mel config for audio processing
      await loadMelConfig(modelPath);

      // Load tokenizer
      report('loading', 0, 'tokenizer');
      const { tokenizer } = await loadTokenizerFromPath(modelPath);
      this.tokenizer = tokenizer;

      // Load config
      report('loading', 5, 'config');
      const configResponse = await fetch(`${modelPath}/config.json`, {
        mode: 'cors',
        credentials: 'omit',
      });
      this.config = await configResponse.json();

      // Extract model dimensions from config
      const lfmConfig = this.config.lfm || {};
      this.hiddenSize = lfmConfig.hidden_size || 2048;
      this.numLayers = lfmConfig.num_hidden_layers || 16;
      this.numKVHeads = lfmConfig.num_key_value_heads || 8;
      this.headDim = Math.floor(this.hiddenSize / (lfmConfig.num_attention_heads || 32));
      this.convL = lfmConfig.conv_L_cache || 3;
      this.layerTypes = lfmConfig.layer_types || [];
      this.vocabSize = lfmConfig.vocab_size || 65536;

      console.log('Model config:', {
        hiddenSize: this.hiddenSize,
        numLayers: this.numLayers,
        numKVHeads: this.numKVHeads,
        headDim: this.headDim,
      });

      // Parse quantization config
      const quantConfig = typeof quantization === 'object' ? quantization : {
        decoder: quantization,
        audioEncoder: quantization,
        audioEmbedding: quantization,
        audioDetokenizer: quantization,
        vocoder: quantization,
      };

      // Helper to load ONNX model with external data
      const loadOnnxWithExternalData = async (name, progress, quantSuffix = null, extraOptions = {}) => {
        const suffix = quantSuffix ? `_${quantSuffix}` : '';
        const fileName = `${name}${suffix}`;
        report('loading', progress, `${fileName}.onnx`);

        const onnxPath = `${modelPath}/onnx/${fileName}.onnx`;
        const fetchOptions = { mode: 'cors', credentials: 'omit' };

        console.log(`Loading ${fileName}...`);

        const sessionOptions = { executionProviders, ...extraOptions };

        const onnxResponse = await fetchWithCache(onnxPath, fetchOptions);
        if (!onnxResponse.ok) {
          throw new Error(`Failed to fetch ${fileName}.onnx: ${onnxResponse.status}`);
        }
        const onnxBuffer = await onnxResponse.arrayBuffer();
        console.log(`Loaded ${fileName}.onnx: ${(onnxBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

        // Load external data files
        sessionOptions.externalData = [];

        // Try single .onnx_data file
        const singleDataPath = `${modelPath}/onnx/${fileName}.onnx_data`;
        try {
          const dataResponse = await fetchWithCache(singleDataPath, fetchOptions);
          const contentType = dataResponse.headers.get('content-type') || '';
          if (dataResponse.ok && !contentType.includes('text/html')) {
            const dataBuffer = await dataResponse.arrayBuffer();
            if (dataBuffer.byteLength > 1000) {  // Sanity check
              console.log(`Loaded ${fileName}.onnx_data: ${(dataBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
              sessionOptions.externalData.push({
                path: `${fileName}.onnx_data`,
                data: new Uint8Array(dataBuffer),
              });
            }
          }
        } catch (e) {
          // File doesn't exist
        }

        // Try numbered files - stop on first 404
        for (let i = 1; ; i++) {
          const numberedDataPath = `${modelPath}/onnx/${fileName}.onnx_data_${i}`;
          const dataResponse = await fetch(numberedDataPath, fetchOptions);
          if (dataResponse.status === 404 || !dataResponse.ok) break;
          const contentType = dataResponse.headers.get('content-type') || '';
          if (contentType.includes('text/html')) break;
          const dataBuffer = await dataResponse.arrayBuffer();
          if (dataBuffer.byteLength < 1000) break;
          console.log(`Loaded ${fileName}.onnx_data_${i}: ${(dataBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
          sessionOptions.externalData.push({
            path: `${fileName}.onnx_data_${i}`,
            data: new Uint8Array(dataBuffer),
          });
        }

        if (sessionOptions.externalData.length === 0) {
          delete sessionOptions.externalData;
        }

        const session = await ort.InferenceSession.create(new Uint8Array(onnxBuffer), sessionOptions);
        console.log(`Session created for ${fileName}`);
        return session;
      };

      // Load decoder
      // On WebGPU: keep KV cache outputs on GPU to avoid GPU→CPU→GPU roundtrips between steps
      const decoderOpts = device === 'webgpu' ? (() => {
        const loc = {};
        for (let i = 0; i < this.layerTypes.length; i++) {
          if (this.layerTypes[i] === 'conv') {
            loc[`present_conv.${i}`] = 'gpu-buffer';
          } else {
            loc[`present.${i}.key`] = 'gpu-buffer';
            loc[`present.${i}.value`] = 'gpu-buffer';
          }
        }
        return { preferredOutputLocation: loc };
      })() : {};
      this.decoderSession = await loadOnnxWithExternalData('decoder', 10, quantConfig.decoder, decoderOpts);

      // Load embed_tokens weight for text embedding lookup
      report('loading', 30, 'embed_tokens');
      this.embedTokensWeight = await this.loadEmbedTokensWeight(modelPath);

      // Load audio encoder (for ASR)
      this.audioEncoderSession = await loadOnnxWithExternalData('audio_encoder', 50, quantConfig.audioEncoder);

      // Load audio embedding (for TTS) - try binary first, fallback to ONNX
      report('loading', 65, 'audio_embedding');
      this.audioEmbeddingWeight = await this.loadAudioEmbeddingWeight(modelPath);
      if (!this.audioEmbeddingWeight) {
        // Fallback to ONNX model
        this.audioEmbeddingSession = await loadOnnxWithExternalData('audio_embedding', 70, quantConfig.audioEmbedding);
      } else {
        console.log('Using direct audio embedding lookup (binary)');
      }

      // Load audio detokenizer (for TTS output)
      try {
        this.audioDetokenizerSession = await loadOnnxWithExternalData('audio_detokenizer', 85, quantConfig.audioDetokenizer);
      } catch (e) {
        console.warn('Audio detokenizer not available:', e);
      }

      // Load vocoder (for TTS)
      // On WebGPU: keep KV cache on GPU to avoid GPU→CPU→GPU roundtrips between steps
      try {
        const vocoderOpts = device === 'webgpu'
          ? { preferredOutputLocation: { new_keys: 'gpu-buffer', new_values: 'gpu-buffer' } }
          : {};
        this.vocoderSession = await loadOnnxWithExternalData('vocoder_depthformer', 95, quantConfig.vocoder, vocoderOpts);
      } catch (e) {
        console.warn('Vocoder not available:', e);
      }

      report('done', 100, '');
      return true;

    } catch (error) {
      let errorMessage = error;
      if (typeof error === 'number') {
        errorMessage = `ONNX Runtime error code: ${error}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error('Failed to load audio model:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Get audio embeddings for given token indices and sum across codebooks
   *
   * Uses direct array indexing if binary weight available (fast),
   * falls back to ONNX session otherwise.
   *
   * @param {number[]} audioTokens - Array of 8 token indices (one per codebook)
   * @returns {Float32Array} Summed embedding [hiddenSize]
   */
  async getAudioEmbedding(audioTokens) {
    const NUM_CODEBOOKS = 8;
    const hiddenSize = this.hiddenSize;
    const summedEmbeds = new Float32Array(hiddenSize);

    if (this.audioEmbeddingWeight) {
      // Direct lookup (much faster - no ONNX call)
      const weight = this.audioEmbeddingWeight.weight;
      for (let cb = 0; cb < NUM_CODEBOOKS; cb++) {
        const tokenIdx = audioTokens[cb];
        const offset = tokenIdx * hiddenSize;
        for (let h = 0; h < hiddenSize; h++) {
          summedEmbeds[h] += weight[offset + h];
        }
      }
    } else {
      // Fallback to ONNX session
      const audioTokensTensor = new ort.Tensor('int64', new BigInt64Array(audioTokens.map(BigInt)), [1, NUM_CODEBOOKS]);
      const result = await this.audioEmbeddingSession.run({ audio_codes: audioTokensTensor });
      const embeddings = result.audio_embeds.data;

      for (let cb = 0; cb < NUM_CODEBOOKS; cb++) {
        for (let h = 0; h < hiddenSize; h++) {
          summedEmbeds[h] += embeddings[cb * hiddenSize + h];
        }
      }
    }

    return summedEmbeds;
  }

  /**
   * Load audio_embedding.weight from raw binary file for direct lookup
   *
   * This eliminates ONNX model calls (352 per generation → 0).
   * Falls back to ONNX session if binary not available.
   */
  async loadAudioEmbeddingWeight(modelPath) {
    const fetchOptions = { mode: 'cors', credentials: 'omit' };

    try {
      // Load metadata
      const metaResponse = await fetchWithCache(`${modelPath}/onnx/audio_embedding.json`, fetchOptions);
      if (!metaResponse.ok) {
        console.log('audio_embedding.json not found, will use ONNX model');
        return null;
      }
      const meta = await metaResponse.json();
      console.log('audio_embedding metadata:', meta);

      // Load binary weight
      const binResponse = await fetchWithCache(`${modelPath}/onnx/audio_embedding.bin`, fetchOptions);
      if (!binResponse.ok) {
        console.log('audio_embedding.bin not found, will use ONNX model');
        return null;
      }
      const buffer = await binResponse.arrayBuffer();
      const weight = new Float32Array(buffer);

      if (weight.length !== meta.vocab_size * meta.hidden_size) {
        console.error('audio_embedding size mismatch:', weight.length, 'expected:', meta.vocab_size * meta.hidden_size);
        return null;
      }

      console.log(`Loaded audio_embedding: [${meta.vocab_size}, ${meta.hidden_size}] (${(buffer.byteLength / 1e6).toFixed(1)} MB)`);
      return { weight, vocabSize: meta.vocab_size, hiddenSize: meta.hidden_size };
    } catch (e) {
      console.log('Failed to load audio_embedding.bin:', e);
      return null;
    }
  }

  /**
   * Load embed_tokens.weight from raw binary file for text embedding lookup
   *
   * The Python export saves embed_tokens.weight as:
   * - embed_tokens.bin: raw float32 binary (vocab_size * hidden_size * 4 bytes)
   * - embed_tokens.json: metadata (vocab_size, hidden_size)
   */
  async loadEmbedTokensWeight(modelPath) {
    const fetchOptions = { mode: 'cors', credentials: 'omit' };

    // Load metadata
    const metaResponse = await fetchWithCache(`${modelPath}/onnx/embed_tokens.json`, fetchOptions);
    if (!metaResponse.ok) {
      console.warn('embed_tokens.json not found, TTS will be unavailable');
      return null;
    }
    const meta = await metaResponse.json();
    console.log('embed_tokens metadata:', meta);

    // Load binary weight
    const binResponse = await fetchWithCache(`${modelPath}/onnx/embed_tokens.bin`, fetchOptions);
    if (!binResponse.ok) {
      console.warn('embed_tokens.bin not found, TTS will be unavailable');
      return null;
    }
    const buffer = await binResponse.arrayBuffer();
    const weight = new Float32Array(buffer);

    if (weight.length !== meta.vocab_size * meta.hidden_size) {
      console.error('embed_tokens size mismatch:', weight.length, 'expected:', meta.vocab_size * meta.hidden_size);
      return null;
    }

    console.log(`Loaded embed_tokens: [${meta.vocab_size}, ${meta.hidden_size}] (${(buffer.byteLength / 1e6).toFixed(1)} MB)`);
    return { weight, vocabSize: meta.vocab_size, hiddenSize: meta.hidden_size };
  }

  /**
   * Get text embeddings for token IDs using pre-loaded weight
   * @param {number[]} tokenIds - Array of token IDs
   * @returns {ort.Tensor} - Embeddings tensor [1, seq_len, hidden_size]
   */
  getTextEmbeddings(tokenIds) {
    if (!this.embedTokensWeight) {
      throw new Error('embed_tokens weight not loaded');
    }

    const { weight, hiddenSize } = this.embedTokensWeight;
    const seqLen = tokenIds.length;
    const embeddings = new Float32Array(seqLen * hiddenSize);

    for (let i = 0; i < seqLen; i++) {
      const tokenId = tokenIds[i];
      const srcOffset = tokenId * hiddenSize;
      const dstOffset = i * hiddenSize;
      embeddings.set(weight.subarray(srcOffset, srcOffset + hiddenSize), dstOffset);
    }

    return new ort.Tensor('float32', embeddings, [1, seqLen, hiddenSize]);
  }

  /**
   * Initialize KV cache for generation
   */
  initializeCache() {
    const cache = {};

    for (let idx = 0; idx < this.layerTypes.length; idx++) {
      const layerType = this.layerTypes[idx];
      if (layerType === 'conv') {
        cache[`past_conv.${idx}`] = new ort.Tensor(
          'float32',
          new Float32Array(1 * this.hiddenSize * this.convL),
          [1, this.hiddenSize, this.convL]
        );
      } else {
        cache[`past_key_values.${idx}.key`] = new ort.Tensor(
          'float32',
          new Float32Array(0),
          [1, this.numKVHeads, 0, this.headDim]
        );
        cache[`past_key_values.${idx}.value`] = new ort.Tensor(
          'float32',
          new Float32Array(0),
          [1, this.numKVHeads, 0, this.headDim]
        );
      }
    }

    return cache;
  }

  /**
   * Update cache from decoder outputs
   */
  updateCache(cache, outputs) {
    for (const name of Object.keys(outputs)) {
      if (name.startsWith('present_conv.')) {
        const cacheName = name.replace('present_conv', 'past_conv');
        if (cacheName in cache) {
          cache[cacheName] = outputs[name];
        }
      } else if (name.startsWith('present.')) {
        const cacheName = name.replace('present.', 'past_key_values.');
        if (cacheName in cache) {
          cache[cacheName] = outputs[name];
        }
      }
    }
  }

  /**
   * Run decoder with embeddings
   */
  async runDecoder(embeds, attentionMask, cache) {
    const feeds = {
      inputs_embeds: embeds,
      attention_mask: attentionMask,
      ...cache,
    };

    const outputs = await this.decoderSession.run(feeds);

    return {
      logits: outputs.logits,
      hiddenStates: outputs.hidden_states,
      outputs,
    };
  }

  /**
   * Sample next token
   */
  sampleToken(logits, temperature = 0.7) {
    if (temperature === 0) {
      let maxIdx = 0;
      let maxVal = logits[0];
      for (let i = 1; i < logits.length; i++) {
        if (logits[i] > maxVal) {
          maxVal = logits[i];
          maxIdx = i;
        }
      }
      return maxIdx;
    }

    // Temperature sampling
    const scaledLogits = new Float32Array(logits.length);
    let maxLogit = -Infinity;
    for (let i = 0; i < logits.length; i++) {
      scaledLogits[i] = logits[i] / temperature;
      maxLogit = Math.max(maxLogit, scaledLogits[i]);
    }

    let sumExp = 0;
    for (let i = 0; i < scaledLogits.length; i++) {
      scaledLogits[i] = Math.exp(scaledLogits[i] - maxLogit);
      sumExp += scaledLogits[i];
    }

    const probs = new Float32Array(scaledLogits.length);
    for (let i = 0; i < probs.length; i++) {
      probs[i] = scaledLogits[i] / sumExp;
    }

    // Sample from distribution
    const r = Math.random();
    let cumsum = 0;
    for (let i = 0; i < probs.length; i++) {
      cumsum += probs[i];
      if (r < cumsum) return i;
    }
    return probs.length - 1;
  }

  /**
   * Transcribe audio to text (ASR mode)
   * @param {Float32Array} audioData - Audio samples in [-1, 1]
   * @param {number} sampleRate - Audio sample rate
   * @param {object} options - Generation options
   */
  async transcribe(audioData, sampleRate, options = {}) {
    const {
      maxNewTokens = DEFAULT_MAX_TOKENS_TEXT,
      temperature = 0,
      systemPrompt = DEFAULT_SYSTEM_PROMPT_ASR,
      onToken,
    } = options;

    if (!this.audioEncoderSession) {
      throw new Error('Audio encoder not loaded');
    }

    if (!this.embedTokensWeight) {
      throw new Error('embed_tokens not loaded - required for ASR');
    }

    logReset();
    log('=== ASR Transcription ===');
    log('Audio samples:', audioData.length, 'Sample rate:', sampleRate);

    // 1. Compute mel spectrogram
    const { melFeatures, numFrames } = computeMelSpectrogram(audioData, sampleRate);
    log('Mel spectrogram frames:', numFrames);

    // 2. Run audio encoder
    const melTensor = new ort.Tensor(
      'float32',
      melFeatures,
      [1, numFrames, 128]  // [batch, time, n_mels]
    );

    const melLengths = new ort.Tensor(
      'int64',
      new BigInt64Array([BigInt(numFrames)]),
      [1]
    );

    const encoderOutputs = await this.audioEncoderSession.run({
      mel_spectrogram: melTensor,
      mel_lengths: melLengths,
    });

    const audioEmbeds = encoderOutputs.audio_embeddings;
    log('Audio embeddings shape:', audioEmbeds.dims);

    // 3. Build prompt: prefix + audio + suffix
    const prefixText = `<|startoftext|><|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n`;
    const suffixText = '<|im_end|>\n<|im_start|>assistant\n';

    // Use add_special_tokens: false to match Python behavior (prompt already has special tokens)
    const prefixIds = Array.from(this.tokenizer.encode(prefixText, { add_special_tokens: false }));
    const suffixIds = Array.from(this.tokenizer.encode(suffixText, { add_special_tokens: false }));

    log('Prefix tokens:', prefixIds.length, 'Suffix tokens:', suffixIds.length);

    // Get text embeddings
    const prefixEmbeds = this.getTextEmbeddings(prefixIds);
    const suffixEmbeds = this.getTextEmbeddings(suffixIds);

    // 4. Concatenate embeddings: prefix + audio + suffix
    const prefixLen = prefixIds.length;
    const audioLen = audioEmbeds.dims[1];
    const suffixLen = suffixIds.length;
    const totalLen = prefixLen + audioLen + suffixLen;

    const { hiddenSize } = this.embedTokensWeight;
    const allEmbeds = new Float32Array(totalLen * hiddenSize);

    // Copy prefix embeddings
    allEmbeds.set(prefixEmbeds.data, 0);
    // Copy audio embeddings
    allEmbeds.set(new Float32Array(audioEmbeds.data.buffer, audioEmbeds.data.byteOffset, audioLen * hiddenSize), prefixLen * hiddenSize);
    // Copy suffix embeddings
    allEmbeds.set(suffixEmbeds.data, (prefixLen + audioLen) * hiddenSize);

    const inputEmbeds = new ort.Tensor('float32', allEmbeds, [1, totalLen, hiddenSize]);
    const attentionMask = new ort.Tensor('int64', new BigInt64Array(totalLen).fill(1n), [1, totalLen]);

    // 5. Initialize cache and run prefill
    const cache = this.initializeCache();
    let { logits, hiddenStates, outputs } = await this.runDecoder(inputEmbeds, attentionMask, cache);
    this.updateCache(cache, outputs);

    // 6. Generate tokens
    const generatedTokens = [];
    let currentLen = totalLen;

    for (let i = 0; i < maxNewTokens; i++) {
      // Get logits for last position - shape is [1, seq_len, vocab_size]
      const logitsData = logits.data;
      const seqLen = logits.dims[1];
      const lastLogits = new Float32Array(this.vocabSize);
      const offset = (seqLen - 1) * this.vocabSize;
      for (let j = 0; j < this.vocabSize; j++) {
        lastLogits[j] = logitsData[offset + j];
      }
      const nextToken = this.sampleToken(lastLogits, temperature);

      // Check for stop tokens
      if (nextToken === this.tokenizer.eos_token_id || nextToken === SPECIAL_TOKENS.IM_END) {
        log('Stop token reached');
        break;
      }

      generatedTokens.push(nextToken);
      if (onToken) {
        const text = this.tokenizer.decode(generatedTokens);
        onToken(text, nextToken);
      }

      // Get embedding for next token
      const nextEmbeds = this.getTextEmbeddings([nextToken]);
      currentLen++;
      const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);

      // Run decoder with single token
      ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, cache));
      this.updateCache(cache, outputs);
    }

    const result = this.tokenizer.decode(generatedTokens);
    log(`Generated ${generatedTokens.length} tokens: "${result}"`);
    return result;
  }

  /**
   * Generate response from messages
   * @param {Array} messages - Chat messages
   * @param {object} options - Generation options
   */
  async generate(messages, options = {}) {
    const { maxNewTokens = 256, onToken, audioData = null, sampleRate = null } = options;

    // If audio data provided, do ASR
    if (audioData && sampleRate) {
      return this.transcribe(audioData, sampleRate, {
        maxNewTokens,
        onToken,
      });
    }

    // Text-only generation (simplified)
    const prompt = this.tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      tokenize: false,
    });

    const inputIds = this.tokenizer.encode(prompt);
    console.log('Input tokens:', inputIds.length);

    // Initialize cache
    const cache = this.initializeCache();
    const generatedTokens = [];

    // Note: Full implementation needs proper text embedding support
    // This is a placeholder that shows the model is loaded

    return '[Text generation requires full embedding support - model loaded successfully]';
  }

  /**
   * Initialize reusable vocoder tensors to reduce allocation overhead
   */
  _initVocoderCache() {
    if (this._vocoderCache) return;

    const numLayers = 6;
    const numKvHeads = 8;
    const headDim = 32;

    // Pre-allocate data arrays
    const stepIdxData = new BigInt64Array(1);
    const prevTokenData = new BigInt64Array(1);

    // Pre-allocate tensors that can be reused
    this._vocoderCache = {
      hiddenTensor: null,  // Created per-call since hiddenState changes
      stepIdxData,
      prevTokenData,
      // Pre-create reusable tensors (ONNX Runtime reads from the data array)
      stepIdxTensor: new ort.Tensor('int64', stepIdxData, []),
      prevTokenTensor: new ort.Tensor('int64', prevTokenData, [1]),
      emptyKeysData: new Float32Array(0),
      emptyValuesData: new Float32Array(0),
      // Reusable sampling arrays
      scaledLogits: new Float32Array(2049),  // codebook vocab size
      indices: new Uint16Array(2049),  // Use typed array for faster reset
      probs: new Float32Array(64),  // top-k size
    };

    // Initialize indices
    for (let i = 0; i < 2049; i++) {
      this._vocoderCache.indices[i] = i;
    }
  }

  /**
   * Sample audio codes using vocoder depthformer
   * Optimized to reduce tensor creation overhead
   * @param {Float32Array} hiddenState - [hidden_size] hidden state
   * @param {number} temperature - Sampling temperature
   * @param {number} topK - Top-k sampling
   * @returns {number[]} - 8 codebook values
   */
  async sampleAudioCodes(hiddenState, temperature = 0.8, topK = 64) {
    if (!this.vocoderSession) {
      throw new Error('Vocoder not loaded');
    }

    // Initialize cache on first call
    this._initVocoderCache();
    const cache = this._vocoderCache;

    const numCodebooks = 8;
    const numLayers = 6;
    const numKvHeads = 8;
    const headDim = 32;

    const codes = [];
    let prevToken = 0;

    // Create hidden state tensor (must be new since data changes)
    const hiddenTensor = new ort.Tensor('float32', hiddenState, [1, this.hiddenSize]);

    // Initialize empty KV cache
    let pastKeys = new ort.Tensor(
      'float32',
      cache.emptyKeysData,
      [numLayers, 1, 0, numKvHeads, headDim]
    );
    let pastValues = new ort.Tensor(
      'float32',
      cache.emptyValuesData,
      [numLayers, 1, 0, numKvHeads, headDim]
    );

    // Reuse step_idx and prev_token tensors by updating their data
    cache.stepIdxData[0] = 0n;
    cache.prevTokenData[0] = 0n;

    for (let i = 0; i < numCodebooks; i++) {
      // Update mutable tensor data (tensor objects reuse the underlying data arrays)
      cache.stepIdxData[0] = BigInt(i);
      cache.prevTokenData[0] = BigInt(prevToken);

      const feeds = {
        hidden_states: hiddenTensor,
        step_idx: cache.stepIdxTensor,
        prev_token: cache.prevTokenTensor,
        past_keys: pastKeys,
        past_values: pastValues,
      };

      const outputs = await this.vocoderSession.run(feeds);
      const logits = outputs.logits.data;
      const vocabSize = logits.length;

      // Sample with temperature and top-k (reusing cached arrays)
      let token;
      if (temperature <= 0) {
        // Greedy
        token = 0;
        let maxVal = logits[0];
        for (let j = 1; j < vocabSize; j++) {
          if (logits[j] > maxVal) {
            maxVal = logits[j];
            token = j;
          }
        }
      } else {
        // Top-k sampling with reused arrays
        const scaledLogits = cache.scaledLogits;
        const indices = cache.indices;
        const probs = cache.probs;

        // Scale logits by temperature and find top-k in single pass
        // Use partial selection sort (O(k*n) which is fast for small k)
        for (let j = 0; j < vocabSize; j++) {
          scaledLogits[j] = logits[j] / temperature;
          indices[j] = j;
        }

        // Partial sort to get top-k
        for (let j = 0; j < topK; j++) {
          let maxIdx = j;
          for (let k = j + 1; k < vocabSize; k++) {
            if (scaledLogits[indices[k]] > scaledLogits[indices[maxIdx]]) {
              maxIdx = k;
            }
          }
          // Swap
          const tmp = indices[j];
          indices[j] = indices[maxIdx];
          indices[maxIdx] = tmp;
        }

        // Softmax over top-k
        const maxLogit = scaledLogits[indices[0]];
        let sumExp = 0;
        for (let j = 0; j < topK; j++) {
          probs[j] = Math.exp(scaledLogits[indices[j]] - maxLogit);
          sumExp += probs[j];
        }
        for (let j = 0; j < topK; j++) {
          probs[j] /= sumExp;
        }

        // Sample
        const r = Math.random();
        let cumsum = 0;
        token = indices[topK - 1];  // Default to last
        for (let j = 0; j < topK; j++) {
          cumsum += probs[j];
          if (r < cumsum) {
            token = indices[j];
            break;
          }
        }
      }

      codes.push(token);
      prevToken = token;

      // Update KV cache
      pastKeys = outputs.new_keys;
      pastValues = outputs.new_values;
    }

    return codes;
  }

  /**
   * Generate speech from text (TTS mode)
   * @param {string} text - Text to convert to speech
   * @param {object} options - Generation options
   * @returns {object} - { audioCodes: number[][], textTokens: number[] }
   */
  async generateSpeech(text, options = {}) {
    const {
      maxNewTokens = DEFAULT_MAX_TOKENS_AUDIO,
      textTemperature = 0.7,
      audioTemperature = 0.8,
      audioTopK = 64,
      systemPrompt = DEFAULT_SYSTEM_PROMPT_TTS,
      onToken,
      onAudioFrame,
    } = options;

    logReset();
    log('=== TTS Generation ===');
    log('Text:', text);

    if (!this.embedTokensWeight) {
      throw new Error('embed_tokens not loaded - required for TTS');
    }

    if (!this.vocoderSession) {
      throw new Error('Vocoder not loaded - required for TTS');
    }

    // Build TTS prompt
    const prompt = `<|startoftext|><|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${text}<|im_end|>\n<|im_start|>assistant\n`;
    // Use add_special_tokens: false to match Python behavior (prompt already has special tokens)
    const inputIds = Array.from(this.tokenizer.encode(prompt, { add_special_tokens: false }));
    log('TTS prompt tokens:', inputIds.length);

    // Get embeddings and run prefill
    const inputEmbeds = this.getTextEmbeddings(inputIds);
    const cache = this.initializeCache();
    const attentionMask = new ort.Tensor('int64', new BigInt64Array(inputIds.length).fill(1n), [1, inputIds.length]);

    let { logits, hiddenStates, outputs } = await this.runDecoder(inputEmbeds, attentionMask, cache);
    this.updateCache(cache, outputs);

    // Phase 1: Generate text until <|audio_start|> token
    const textTokens = [];
    let currentLen = inputIds.length;
    let inAudioMode = false;
    let tokensGenerated = 0;

    while (tokensGenerated < maxNewTokens && !inAudioMode) {
      const logitsData = logits.data;
      const seqLen = logits.dims[1];
      // Get logits for last position - shape is [1, seq_len, vocab_size]
      const lastLogits = new Float32Array(this.vocabSize);
      const offset = (seqLen - 1) * this.vocabSize;
      for (let i = 0; i < this.vocabSize; i++) {
        lastLogits[i] = logitsData[offset + i];
      }
      const nextToken = this.sampleToken(lastLogits, textTemperature);

      tokensGenerated++;

      if (nextToken === this.tokenizer.eos_token_id) {
        console.warn('Model produced EOS before audio, TTS may not work');
        break;
      }

      if (nextToken === SPECIAL_TOKENS.AUDIO_START) {
        log('Model entered audio mode');
        inAudioMode = true;
        // Feed audio_start token to get hidden states for first audio frame
        const nextEmbeds = this.getTextEmbeddings([SPECIAL_TOKENS.AUDIO_START]);
        currentLen++;
        const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
        ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, cache));
        this.updateCache(cache, outputs);
        break;
      }

      textTokens.push(nextToken);

      // Continue text generation
      const nextEmbeds = this.getTextEmbeddings([nextToken]);
      currentLen++;
      const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
      ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, cache));
      this.updateCache(cache, outputs);
    }

    if (!inAudioMode) {
      console.warn('Model did not enter audio mode, forcing audio generation');
      // Force audio start token
      const nextEmbeds = this.getTextEmbeddings([SPECIAL_TOKENS.AUDIO_START]);
      currentLen++;
      const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
      ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, cache));
      this.updateCache(cache, outputs);
      tokensGenerated++;
    }

    // Phase 2: Generate audio frames using depthformer
    const audioCodes = [];
    const startTime = performance.now();

    while (tokensGenerated < maxNewTokens) {
      // Get hidden state for last position
      const hiddenData = hiddenStates.data;
      const seqLen = hiddenStates.dims[1];
      const lastHidden = hiddenData.slice((seqLen - 1) * this.hiddenSize, seqLen * this.hiddenSize);

      // Sample audio codes
      const frameCodes = await this.sampleAudioCodes(lastHidden, audioTemperature, audioTopK);

      // Check for end-of-audio
      // Only check first codebook (matching liquid-audio TTS behavior)
      if (frameCodes[0] >= END_OF_AUDIO_TOKEN) {
        log(`End of audio at frame ${audioCodes.length}`);
        break;
      }

      // Log progress periodically
      if (audioCodes.length % 50 === 0) {
        log(`Generated ${audioCodes.length} audio frames`);
      }

      audioCodes.push(frameCodes);
      tokensGenerated++;

      if (onAudioFrame) {
        onAudioFrame(frameCodes, audioCodes.length);
      }

      // Feed back audio codes to continue generation
      // Audio embedding expects tokens in range [0, 16392) where:
      // token = codebook_idx * 2049 + code_value
      const clampedCodes = frameCodes.map(c => Math.min(c, 2047));
      const audioTokens = clampedCodes.map((code, idx) => idx * CODEBOOK_VOCAB + code);

      // Get summed embeddings for all 8 codebooks
      const summedEmbeds = await this.getAudioEmbedding(audioTokens);
      const nextEmbeds = new ort.Tensor('float32', summedEmbeds, [1, 1, this.hiddenSize]);
      currentLen++;
      const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
      ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, cache));
      this.updateCache(cache, outputs);
    }

    const elapsed = (performance.now() - startTime) / 1000;
    const framesPerSec = audioCodes.length / elapsed;
    log(`Generated ${audioCodes.length} audio frames in ${elapsed.toFixed(2)}s (${framesPerSec.toFixed(1)} frames/s)`);

    const textOutput = textTokens.length > 0 ? this.tokenizer.decode(textTokens) : '';
    return { audioCodes, textTokens, textOutput };
  }

  /**
   * Generate interleaved response (mixed text/audio) with stateful KV cache.
   *
   * The cache is preserved between calls for multi-turn conversation.
   * Call reset() to start a new conversation.
   *
   * @param {Float32Array} audioData - Input audio samples
   * @param {number} sampleRate - Audio sample rate
   * @param {string} textPrompt - Optional text prompt (unused, for API compatibility)
   * @param {object} options - Generation options
   * @returns {object} - { text: string, audioCodes: number[][] }
   */
  async generateInterleaved(audioData, sampleRate, textPrompt = '', options = {}) {
    const {
      maxNewTokens = DEFAULT_MAX_TOKENS_AUDIO,
      textTemperature = 1.0,
      audioTemperature = 1.0,
      audioTopK = 4,
      systemPrompt = DEFAULT_SYSTEM_PROMPT_INTERLEAVED,
      onToken,
      onAudioFrame,
    } = options;

    // Counter-based mode switching (matching liquid-audio)
    const INTERLEAVED_N_TEXT = 6;
    const INTERLEAVED_N_AUDIO = 12;

    logReset();
    log('=== Interleaved Generation ===');
    log('Cache state:', this.cache ? `exists (seq_len=${this.cacheSeqLen})` : 'null (new conversation)');
    log('Audio samples:', audioData.length, 'Sample rate:', sampleRate);

    if (!this.audioEncoderSession) {
      throw new Error('Audio encoder not loaded - required for interleaved mode');
    }

    if (!this.embedTokensWeight) {
      throw new Error('embed_tokens not loaded - required for interleaved mode');
    }

    if (!this.vocoderSession) {
      throw new Error('Vocoder not loaded - required for interleaved mode');
    }

    // Timing accumulators
    let timeAudioEncode = 0;
    let timePrefill = 0;
    let timeTextDecode = 0;
    let timeAudioDecode = 0;
    let timeVocoder = 0;
    let timeAudioEmbed = 0;

    // 1. Compute mel spectrogram and encode audio
    let tStep = performance.now();
    const { melFeatures, numFrames } = computeMelSpectrogram(audioData, sampleRate);
    const timeMel = performance.now() - tStep;

    const melTensor = new ort.Tensor('float32', melFeatures, [1, numFrames, 128]);
    const melLengths = new ort.Tensor('int64', new BigInt64Array([BigInt(numFrames)]), [1]);

    tStep = performance.now();
    const encoderOutputs = await this.audioEncoderSession.run({
      mel_spectrogram: melTensor,
      mel_lengths: melLengths,
    });
    timeAudioEncode = performance.now() - tStep;

    const audioEmbeds = encoderOutputs.audio_embeddings;
    log(`Mel: ${timeMel.toFixed(0)}ms, AudioEnc: ${timeAudioEncode.toFixed(0)}ms, frames: ${numFrames}`);

    const { hiddenSize } = this.embedTokensWeight;

    // 2. Build prompt based on whether this is first turn or continuation
    let inputEmbeds;
    let newSeqLen;

    if (this.cache === null) {
      // === First turn: full prompt with system message ===
      log('First turn - initializing conversation');
      this.cache = this.initializeCache();
      this.cacheSeqLen = 0;

      const prefixText = `<|startoftext|><|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n`;
      const suffixText = '<|im_end|>\n<|im_start|>assistant\n';

      const prefixIds = Array.from(this.tokenizer.encode(prefixText, { add_special_tokens: false }));
      const suffixIds = Array.from(this.tokenizer.encode(suffixText, { add_special_tokens: false }));

      const prefixEmbeds = this.getTextEmbeddings(prefixIds);
      const suffixEmbeds = this.getTextEmbeddings(suffixIds);

      const prefixLen = prefixIds.length;
      const audioLen = audioEmbeds.dims[1];
      const suffixLen = suffixIds.length;
      newSeqLen = prefixLen + audioLen + suffixLen;

      const allEmbeds = new Float32Array(newSeqLen * hiddenSize);
      allEmbeds.set(prefixEmbeds.data, 0);
      allEmbeds.set(
        new Float32Array(audioEmbeds.data.buffer, audioEmbeds.data.byteOffset, audioLen * hiddenSize),
        prefixLen * hiddenSize
      );
      allEmbeds.set(suffixEmbeds.data, (prefixLen + audioLen) * hiddenSize);

      inputEmbeds = new ort.Tensor('float32', allEmbeds, [1, newSeqLen, hiddenSize]);
    } else {
      // === Continuation: user turn only ===
      log(`Continuing conversation (cache seq_len=${this.cacheSeqLen})`);

      const userPrefixText = '<|im_start|>user\n';
      const suffixText = '<|im_end|>\n<|im_start|>assistant\n';

      const userPrefixIds = Array.from(this.tokenizer.encode(userPrefixText, { add_special_tokens: false }));
      const suffixIds = Array.from(this.tokenizer.encode(suffixText, { add_special_tokens: false }));

      const userPrefixEmbeds = this.getTextEmbeddings(userPrefixIds);
      const suffixEmbeds = this.getTextEmbeddings(suffixIds);

      const userPrefixLen = userPrefixIds.length;
      const audioLen = audioEmbeds.dims[1];
      const suffixLen = suffixIds.length;
      newSeqLen = userPrefixLen + audioLen + suffixLen;

      const allEmbeds = new Float32Array(newSeqLen * hiddenSize);
      allEmbeds.set(userPrefixEmbeds.data, 0);
      allEmbeds.set(
        new Float32Array(audioEmbeds.data.buffer, audioEmbeds.data.byteOffset, audioLen * hiddenSize),
        userPrefixLen * hiddenSize
      );
      allEmbeds.set(suffixEmbeds.data, (userPrefixLen + audioLen) * hiddenSize);

      inputEmbeds = new ort.Tensor('float32', allEmbeds, [1, newSeqLen, hiddenSize]);
    }

    // 3. Run prefill with attention mask covering full sequence
    const totalLen = this.cacheSeqLen + newSeqLen;
    const attentionMask = new ort.Tensor('int64', new BigInt64Array(totalLen).fill(1n), [1, totalLen]);

    tStep = performance.now();
    let { logits, hiddenStates, outputs } = await this.runDecoder(inputEmbeds, attentionMask, this.cache);
    timePrefill = performance.now() - tStep;
    this.updateCache(this.cache, outputs);
    this.cacheSeqLen = totalLen;
    log(`Prefill: ${timePrefill.toFixed(0)}ms, new tokens: ${newSeqLen}, total: ${totalLen}`);

    // 4. Generate with counter-based mode switching
    const textTokens = [];
    const audioCodes = [];
    let currentLen = totalLen;
    let inAudioMode = false;
    let modalityLeft = INTERLEAVED_N_TEXT;
    let textDone = false;

    const startTime = performance.now();

    for (let step = 0; step < maxNewTokens; step++) {
      modalityLeft--;

      if (inAudioMode) {
        // Generate audio frame using depthformer
        const hiddenData = hiddenStates.data;
        const seqLen = hiddenStates.dims[1];
        const lastHidden = hiddenData.slice((seqLen - 1) * hiddenSize, seqLen * hiddenSize);

        tStep = performance.now();
        const frameCodes = await this.sampleAudioCodes(lastHidden, audioTemperature, audioTopK);
        timeVocoder += performance.now() - tStep;

        // Switch back to text after N audio frames (if text not done)
        if (modalityLeft <= 0 && !textDone) {
          inAudioMode = false;
          modalityLeft = INTERLEAVED_N_TEXT;
        }

        // Check for end of audio - first codebook == 2048 (matching liquid-audio)
        if (frameCodes[0] === END_OF_AUDIO_TOKEN) {
          log(`End of audio at step ${step}`);
          // Set all codes to 2048 (matching liquid-audio)
          for (let i = 0; i < NUM_CODEBOOKS; i++) {
            frameCodes[i] = END_OF_AUDIO_TOKEN;
          }
          inAudioMode = false;
          // Don't save this frame, but still feed it back
        } else {
          // Save valid frame (clamped to 0-2047)
          const clampedFrame = frameCodes.map(c => Math.min(c, 2047));
          audioCodes.push(clampedFrame);

          if (onAudioFrame) {
            onAudioFrame(clampedFrame, audioCodes.length);
          }

          if (audioCodes.length % 50 === 0) {
            log(`Generated ${audioCodes.length} audio frames`);
          }
        }

        // Get embeddings for next step (always feed back, even for 2048 frames)
        tStep = performance.now();
        const feedCodes = frameCodes.map(c => c === END_OF_AUDIO_TOKEN ? END_OF_AUDIO_TOKEN : Math.min(c, 2047));
        const audioTokens = feedCodes.map((code, idx) => idx * CODEBOOK_VOCAB + code);

        // Get summed embeddings for all 8 codebooks
        const summedEmbeds = await this.getAudioEmbedding(audioTokens);
        timeAudioEmbed += performance.now() - tStep;

        const nextEmbeds = new ort.Tensor('float32', summedEmbeds, [1, 1, hiddenSize]);
        currentLen++;
        const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
        tStep = performance.now();
        ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, this.cache));
        timeAudioDecode += performance.now() - tStep;
        this.updateCache(this.cache, outputs);

      } else {
        // Generate text token
        const logitsData = logits.data;
        const seqLen = logits.dims[1];
        // Get logits for last position - shape is [1, seq_len, vocab_size]
        const lastLogits = new Float32Array(this.vocabSize);
        const offset = (seqLen - 1) * this.vocabSize;
        for (let i = 0; i < this.vocabSize; i++) {
          lastLogits[i] = logitsData[offset + i];
        }
        const token = this.sampleToken(lastLogits, textTemperature);

        // Check for end of turn
        if (token === this.tokenizer.eos_token_id || token === SPECIAL_TOKENS.IM_END) {
          log(`End of turn at step ${step}`);
          break;
        }

        // Check for <|text_end|> token (130)
        if (token === SPECIAL_TOKENS.TEXT_END) {
          log(`Text end at step ${step}`);
          textDone = true;
        }

        // Switch to audio after N text tokens OR text_end
        if (modalityLeft <= 0 || textDone) {
          inAudioMode = true;
          modalityLeft = INTERLEAVED_N_AUDIO;
        }

        textTokens.push(token);

        if (onToken) {
          const decodedText = this.tokenizer.decode(textTokens, { skip_special_tokens: true });
          onToken(decodedText, token);
        }

        // Get embedding for next step
        const nextEmbeds = this.getTextEmbeddings([token]);
        currentLen++;
        const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
        tStep = performance.now();
        ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, this.cache));
        timeTextDecode += performance.now() - tStep;
        this.updateCache(this.cache, outputs);
      }
    }

    // 5. Feed <|im_end|> token to close assistant turn in cache
    const imEndEmbeds = this.getTextEmbeddings([SPECIAL_TOKENS.IM_END]);
    currentLen++;
    const finalMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
    ({ outputs } = await this.runDecoder(imEndEmbeds, finalMask, this.cache));
    this.updateCache(this.cache, outputs);
    this.cacheSeqLen = currentLen;

    // Decode with skip_special_tokens to clean up special tokens like <|text_end|>
    const text = this.tokenizer.decode(textTokens, { skip_special_tokens: true });

    // Print timing summary
    log(`=== Summary ===`);
    log(`  Mel: ${timeMel.toFixed(0)}ms, AudioEnc: ${timeAudioEncode.toFixed(0)}ms, Prefill: ${timePrefill.toFixed(0)}ms`);
    log(`  TextDec: ${timeTextDecode.toFixed(0)}ms (${textTokens.length} tok), AudioDec: ${timeAudioDecode.toFixed(0)}ms`);
    log(`  Vocoder: ${timeVocoder.toFixed(0)}ms, AudioEmbed: ${timeAudioEmbed.toFixed(0)}ms`);
    log(`Output: ${textTokens.length} text tokens, ${audioCodes.length} audio frames`);
    log(`Text: "${text}"`);
    log(`Cache seq_len: ${this.cacheSeqLen}`);

    return { text, audioCodes };
  }

  /**
   * Generate interleaved response from text-only input (continuation turn).
   * Uses the stateful KV cache from previous turns. Produces both text AND audio.
   *
   * @param {string} userText - User's text message
   * @param {object} options - Generation options
   * @returns {object} - { text: string, audioCodes: number[][] }
   */
  async generateInterleavedFromText(userText, options = {}) {
    const {
      maxNewTokens = DEFAULT_MAX_TOKENS_AUDIO,
      textTemperature = 1.0,
      audioTemperature = 1.0,
      audioTopK = 4,
      systemPrompt = DEFAULT_SYSTEM_PROMPT_INTERLEAVED,
      onToken,
      onAudioFrame,
    } = options;

    // Counter-based mode switching (matching liquid-audio)
    const INTERLEAVED_N_TEXT = 6;
    const INTERLEAVED_N_AUDIO = 12;

    logReset();
    log('=== Text-Only Interleaved Generation ===');
    log(`Cache state: ${this.cache ? `exists (seq_len=${this.cacheSeqLen})` : 'null (new conversation)'}`);
    log(`User text: ${userText}`);

    if (!this.embedTokensWeight) {
      throw new Error('embed_tokens not loaded - required for text generation');
    }

    if (!this.vocoderSession) {
      throw new Error('Vocoder not loaded - required for interleaved mode');
    }

    // Timing accumulators
    let timePrefill = 0;
    let timeTextDecode = 0;
    let timeAudioDecode = 0;
    let timeVocoder = 0;
    let timeAudioEmbed = 0;
    let tStep;

    const { hiddenSize } = this.embedTokensWeight;

    // Build prompt based on whether this is first turn or continuation
    let inputEmbeds;
    let newSeqLen;

    if (this.cache === null) {
      // === First turn: full prompt with system message ===
      log('First turn - initializing conversation');
      this.cache = this.initializeCache();
      this.cacheSeqLen = 0;

      const prefixText = `<|startoftext|><|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;

      const prefixIds = Array.from(this.tokenizer.encode(prefixText, { add_special_tokens: false }));
      const prefixEmbeds = this.getTextEmbeddings(prefixIds);

      newSeqLen = prefixIds.length;
      inputEmbeds = new ort.Tensor('float32', prefixEmbeds.data, [1, newSeqLen, hiddenSize]);
    } else {
      // === Continuation: user turn only ===
      log(`Continuing conversation (cache seq_len=${this.cacheSeqLen})`);

      const userTurnText = `<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;
      const userTurnIds = Array.from(this.tokenizer.encode(userTurnText, { add_special_tokens: false }));
      const userTurnEmbeds = this.getTextEmbeddings(userTurnIds);

      newSeqLen = userTurnIds.length;
      inputEmbeds = new ort.Tensor('float32', userTurnEmbeds.data, [1, newSeqLen, hiddenSize]);
    }

    // Run prefill with attention mask covering full sequence
    const totalLen = this.cacheSeqLen + newSeqLen;
    const attentionMask = new ort.Tensor('int64', new BigInt64Array(totalLen).fill(1n), [1, totalLen]);

    tStep = performance.now();
    let { logits, hiddenStates, outputs } = await this.runDecoder(inputEmbeds, attentionMask, this.cache);
    timePrefill = performance.now() - tStep;
    this.updateCache(this.cache, outputs);
    this.cacheSeqLen = totalLen;
    log(`Prefill: ${timePrefill.toFixed(0)}ms, new tokens: ${newSeqLen}, total: ${totalLen}`);

    // Generate with counter-based mode switching
    const textTokens = [];
    const audioCodes = [];
    let currentLen = totalLen;
    let inAudioMode = false;
    let modalityLeft = INTERLEAVED_N_TEXT;
    let textDone = false;

    for (let step = 0; step < maxNewTokens; step++) {
      modalityLeft--;

      if (inAudioMode) {
        // Generate audio frame using depthformer
        const hiddenData = hiddenStates.data;
        const seqLen = hiddenStates.dims[1];
        const lastHidden = hiddenData.slice((seqLen - 1) * hiddenSize, seqLen * hiddenSize);

        tStep = performance.now();
        const frameCodes = await this.sampleAudioCodes(lastHidden, audioTemperature, audioTopK);
        timeVocoder += performance.now() - tStep;

        // Switch back to text after N audio frames (if text not done)
        if (modalityLeft <= 0 && !textDone) {
          inAudioMode = false;
          modalityLeft = INTERLEAVED_N_TEXT;
        }

        // Check for end of audio
        if (frameCodes[0] === END_OF_AUDIO_TOKEN) {
          log(`End of audio at step ${step}`);
          for (let i = 0; i < NUM_CODEBOOKS; i++) {
            frameCodes[i] = END_OF_AUDIO_TOKEN;
          }
          inAudioMode = false;
        } else {
          const clampedFrame = frameCodes.map(c => Math.min(c, 2047));
          audioCodes.push(clampedFrame);

          if (onAudioFrame) {
            onAudioFrame(clampedFrame, audioCodes.length);
          }

          if (audioCodes.length % 50 === 0) {
            log(`Generated ${audioCodes.length} audio frames`);
          }
        }

        // Get embeddings for next step
        tStep = performance.now();
        const feedCodes = frameCodes.map(c => c === END_OF_AUDIO_TOKEN ? END_OF_AUDIO_TOKEN : Math.min(c, 2047));
        const audioTokens = feedCodes.map((code, idx) => idx * CODEBOOK_VOCAB + code);
        const summedEmbeds = await this.getAudioEmbedding(audioTokens);
        timeAudioEmbed += performance.now() - tStep;

        const nextEmbeds = new ort.Tensor('float32', summedEmbeds, [1, 1, hiddenSize]);
        currentLen++;
        const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
        tStep = performance.now();
        ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, this.cache));
        timeAudioDecode += performance.now() - tStep;
        this.updateCache(this.cache, outputs);

      } else {
        // Generate text token
        const logitsData = logits.data;
        const seqLen = logits.dims[1];
        const lastLogits = new Float32Array(this.vocabSize);
        const offset = (seqLen - 1) * this.vocabSize;
        for (let i = 0; i < this.vocabSize; i++) {
          lastLogits[i] = logitsData[offset + i];
        }
        const token = this.sampleToken(lastLogits, textTemperature);

        // Check for end of turn
        if (token === this.tokenizer.eos_token_id || token === SPECIAL_TOKENS.IM_END) {
          log(`End of turn at step ${step}`);
          break;
        }

        // Check for <|text_end|> token
        if (token === SPECIAL_TOKENS.TEXT_END) {
          log(`Text end at step ${step}`);
          textDone = true;
        }

        // Switch to audio after N text tokens OR text_end
        if (modalityLeft <= 0 || textDone) {
          inAudioMode = true;
          modalityLeft = INTERLEAVED_N_AUDIO;
        }

        textTokens.push(token);

        if (onToken) {
          const decodedText = this.tokenizer.decode(textTokens, { skip_special_tokens: true });
          onToken(decodedText, token);
        }

        // Get embedding for next step
        const nextEmbeds = this.getTextEmbeddings([token]);
        currentLen++;
        const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
        tStep = performance.now();
        ({ logits, hiddenStates, outputs } = await this.runDecoder(nextEmbeds, nextMask, this.cache));
        timeTextDecode += performance.now() - tStep;
        this.updateCache(this.cache, outputs);
      }
    }

    // Feed <|im_end|> token to close assistant turn in cache
    const imEndEmbeds = this.getTextEmbeddings([SPECIAL_TOKENS.IM_END]);
    currentLen++;
    const finalMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
    ({ outputs } = await this.runDecoder(imEndEmbeds, finalMask, this.cache));
    this.updateCache(this.cache, outputs);
    this.cacheSeqLen = currentLen;

    const text = this.tokenizer.decode(textTokens, { skip_special_tokens: true });

    log(`=== Summary ===`);
    log(`  Prefill: ${timePrefill.toFixed(0)}ms`);
    log(`  TextDec: ${timeTextDecode.toFixed(0)}ms (${textTokens.length} tok), AudioDec: ${timeAudioDecode.toFixed(0)}ms`);
    log(`  Vocoder: ${timeVocoder.toFixed(0)}ms, AudioEmbed: ${timeAudioEmbed.toFixed(0)}ms`);
    log(`Output: ${textTokens.length} text tokens, ${audioCodes.length} audio frames`);
    log(`Text: "${text}"`);
    log(`Cache seq_len: ${this.cacheSeqLen}`);

    return { text, audioCodes };
  }

  /**
   * Generate text-only response (for follow-up turns without audio).
   * Uses the stateful KV cache from previous interleaved turns.
   *
   * @param {string} userText - User's text input
   * @param {object} options - Generation options
   * @returns {object} - { text: string }
   */
  async generateTextOnly(userText, options = {}) {
    const {
      maxNewTokens = 256,
      temperature = 0.7,
      systemPrompt = 'You are a helpful assistant.',
      onToken,
    } = options;

    logReset();
    log('=== Text-Only Generation ===');
    log('Cache state:', this.cache ? `exists (seq_len=${this.cacheSeqLen})` : 'null (new conversation)');
    log('User text:', userText);

    if (!this.embedTokensWeight) {
      throw new Error('embed_tokens not loaded');
    }

    const { hiddenSize } = this.embedTokensWeight;

    // Build prompt based on whether we have existing cache
    let inputEmbeds;
    let newSeqLen;

    if (this.cache === null) {
      // First turn: include system message
      log('First turn - initializing conversation');
      this.cache = this.initializeCache();
      this.cacheSeqLen = 0;

      const promptText = `<|startoftext|><|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;
      const promptIds = Array.from(this.tokenizer.encode(promptText, { add_special_tokens: false }));
      inputEmbeds = this.getTextEmbeddings(promptIds);
      newSeqLen = promptIds.length;
    } else {
      // Continuation: just user turn
      log(`Continuing conversation (cache seq_len=${this.cacheSeqLen})`);

      const turnText = `<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;
      const turnIds = Array.from(this.tokenizer.encode(turnText, { add_special_tokens: false }));
      inputEmbeds = this.getTextEmbeddings(turnIds);
      newSeqLen = turnIds.length;
    }

    // Run prefill
    const totalLen = this.cacheSeqLen + newSeqLen;
    const attentionMask = new ort.Tensor('int64', new BigInt64Array(totalLen).fill(1n), [1, totalLen]);

    let { logits, outputs } = await this.runDecoder(inputEmbeds, attentionMask, this.cache);
    this.updateCache(this.cache, outputs);
    this.cacheSeqLen = totalLen;

    // Generate tokens
    const textTokens = [];
    let currentLen = totalLen;

    for (let i = 0; i < maxNewTokens; i++) {
      const logitsData = logits.data;
      const seqLen = logits.dims[1];
      const lastLogits = new Float32Array(this.vocabSize);
      const offset = (seqLen - 1) * this.vocabSize;
      for (let j = 0; j < this.vocabSize; j++) {
        lastLogits[j] = logitsData[offset + j];
      }
      const nextToken = this.sampleToken(lastLogits, temperature);

      // Check for stop tokens
      if (nextToken === this.tokenizer.eos_token_id || nextToken === SPECIAL_TOKENS.IM_END) {
        log('Stop token reached');
        break;
      }

      textTokens.push(nextToken);

      if (onToken) {
        const text = this.tokenizer.decode(textTokens, { skip_special_tokens: true });
        onToken(text, nextToken);
      }

      // Get embedding for next token
      const nextEmbeds = this.getTextEmbeddings([nextToken]);
      currentLen++;
      const nextMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
      ({ logits, outputs } = await this.runDecoder(nextEmbeds, nextMask, this.cache));
      this.updateCache(this.cache, outputs);
    }

    // Feed <|im_end|> to close turn
    const imEndEmbeds = this.getTextEmbeddings([SPECIAL_TOKENS.IM_END]);
    currentLen++;
    const finalMask = new ort.Tensor('int64', new BigInt64Array(currentLen).fill(1n), [1, currentLen]);
    ({ outputs } = await this.runDecoder(imEndEmbeds, finalMask, this.cache));
    this.updateCache(this.cache, outputs);
    this.cacheSeqLen = currentLen;

    const text = this.tokenizer.decode(textTokens, { skip_special_tokens: true });
    log(`Generated ${textTokens.length} tokens: "${text}"`);
    log(`Cache seq_len: ${this.cacheSeqLen}`);

    return { text };
  }

  /**
   * Decode audio codes to waveform using audio detokenizer + ISTFT
   * @param {number[][]} audioCodes - Array of [8] codebook values per frame
   * @returns {Float32Array} - Audio waveform samples in [-1, 1]
   */
  async decodeAudioCodes(audioCodes) {
    if (!this.audioDetokenizerSession) {
      throw new Error('Audio detokenizer not loaded');
    }

    if (audioCodes.length < 2) {
      console.warn('Not enough audio codes to decode');
      return new Float32Array(0);
    }

    const decodeStart = performance.now();
    log(`Decoding ${audioCodes.length} audio frames...`);

    // ISTFT parameters (fixed for this model)
    const nFft = 1280;
    const hopLength = 320;
    const winLength = 1280;
    const nFftBins = nFft / 2 + 1;

    // Stack codes: [T, 8] -> [8, T] and add batch -> [1, 8, T]
    const T = audioCodes.length;
    const codesTransposed = new BigInt64Array(8 * T);
    for (let t = 0; t < T; t++) {
      for (let cb = 0; cb < 8; cb++) {
        codesTransposed[cb * T + t] = BigInt(Math.min(audioCodes[t][cb], 2047));
      }
    }

    // Run detokenizer: [1, 8, T] -> [1, T, 1282]
    const codesTensor = new ort.Tensor('int64', codesTransposed, [1, 8, T]);
    const detokStart = performance.now();
    const detokOutputs = await this.audioDetokenizerSession.run({ audio_codes: codesTensor });
    const stftFeatures = detokOutputs.stft_features;
    log(`Detokenizer: ${(performance.now() - detokStart).toFixed(0)}ms, STFT frames: ${stftFeatures.dims[1]}`);

    // Get raw data - shape is [1, T, 1282], we need to skip batch dimension
    const stftData = stftFeatures.data;
    const actualT = stftFeatures.dims[1];

    // Convert to complex STFT: [log_magnitude | angle] -> complex
    const complexStft = new Array(nFftBins);
    for (let f = 0; f < nFftBins; f++) {
      complexStft[f] = new Array(actualT);
      for (let t = 0; t < actualT; t++) {
        const logMag = stftData[t * 1282 + f];
        const angle = stftData[t * 1282 + nFftBins + f];
        const mag = Math.exp(logMag);
        // Store as [real, imag]
        complexStft[f][t] = [mag * Math.cos(angle), mag * Math.sin(angle)];
      }
    }

    // ISTFT with 'same' padding
    const istftStart = performance.now();
    const waveform = this.istftSamePadding(complexStft, nFft, hopLength, winLength, actualT);
    log(`ISTFT: ${(performance.now() - istftStart).toFixed(0)}ms`);

    // Find max/min without spread operator (avoid stack overflow on large arrays)
    let waveMax = -Infinity, waveMin = Infinity;
    for (let i = 0; i < waveform.length; i++) {
      if (waveform[i] > waveMax) waveMax = waveform[i];
      if (waveform[i] < waveMin) waveMin = waveform[i];
    }
    log('ISTFT output - length:', waveform.length, 'max:', waveMax.toFixed(4), 'min:', waveMin.toFixed(4));

    // Check for invalid values
    if (isNaN(waveMax) || isNaN(waveMin) || !isFinite(waveMax) || !isFinite(waveMin)) {
      console.error('ISTFT produced invalid values (NaN/Inf)');
      return new Float32Array(0);
    }

    // Normalize to [-1, 1]
    let maxVal = Math.max(Math.abs(waveMax), Math.abs(waveMin));
    if (maxVal > 0) {
      for (let i = 0; i < waveform.length; i++) {
        waveform[i] = (waveform[i] / maxVal) * 0.9;
      }
    } else {
      console.warn('ISTFT produced all-zero waveform');
    }

    log(`Decoded audio: ${waveform.length} samples (${(waveform.length / 24000).toFixed(2)}s)`);
    return waveform;
  }

  /**
   * ISTFT with 'same' padding matching liquid_audio.
   * Uses Bluestein FFT for O(N log N) IRFFT on any size.
   *
   * Matches Python: np.fft.irfft(spec, n_fft, axis=0, norm="backward")
   */
  istftSamePadding(complexStft, nFft, hopLength, winLength, T) {
    const N = complexStft.length; // nFftBins = nFft/2 + 1 = 641
    const pad = Math.floor((winLength - hopLength) / 2);

    // Generate Hann window
    const window = new Float32Array(winLength);
    for (let i = 0; i < winLength; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winLength - 1)));
    }

    // Initialize Bluestein FFT for size nFft (cached for reuse)
    if (!this._bluesteinCache || this._bluesteinCache.n !== nFft) {
      this._bluesteinCache = this._initBluestein(nFft);
    }
    const bluestein = this._bluesteinCache;

    // Pre-allocate buffers for IFFT
    const fullRe = new Float32Array(nFft);
    const fullIm = new Float32Array(nFft);

    // Process all frames
    const ifftFrames = new Array(T);

    for (let t = 0; t < T; t++) {
      // Build full spectrum from one-sided (conjugate symmetry)
      fullRe.fill(0);
      fullIm.fill(0);

      // Copy positive frequencies
      for (let k = 0; k < N; k++) {
        fullRe[k] = complexStft[k][t][0];
        fullIm[k] = complexStft[k][t][1];
      }

      // Mirror negative frequencies (conjugate symmetry for real signal)
      for (let k = 1; k < N - 1; k++) {
        fullRe[nFft - k] = fullRe[k];
        fullIm[nFft - k] = -fullIm[k];
      }

      // IFFT using Bluestein: IFFT(X) = conj(FFT(conj(X))) / N
      // Conjugate input
      for (let i = 0; i < nFft; i++) fullIm[i] = -fullIm[i];
      // FFT
      this._bluesteinFFT(fullRe, fullIm, bluestein);
      // Conjugate and scale
      for (let i = 0; i < nFft; i++) {
        fullRe[i] /= nFft;
        fullIm[i] = -fullIm[i] / nFft;
      }

      // Apply window (take first winLength samples)
      const windowedFrame = new Float32Array(winLength);
      for (let n = 0; n < winLength; n++) {
        windowedFrame[n] = fullRe[n] * window[n];
      }
      ifftFrames[t] = windowedFrame;

      // Debug first frame
      if (t === 0) {
        let maxVal = 0;
        let hasNaN = false;
        for (let n = 0; n < winLength; n++) {
          if (isNaN(windowedFrame[n]) || !isFinite(windowedFrame[n])) {
            hasNaN = true;
            break;
          }
          const absVal = Math.abs(windowedFrame[n] / (window[n] + 1e-10));
          if (absVal > maxVal) maxVal = absVal;
        }
        if (hasNaN) {
          console.error('IRFFT frame 0 contains NaN/Inf values!');
        }
      }
    }

    // Overlap-add
    const outputSize = (T - 1) * hopLength + winLength;
    const audio = new Float32Array(outputSize);
    const windowEnvelope = new Float32Array(outputSize);
    const windowSq = new Float32Array(winLength);
    for (let i = 0; i < winLength; i++) {
      windowSq[i] = window[i] * window[i];
    }

    for (let t = 0; t < T; t++) {
      const start = t * hopLength;
      for (let n = 0; n < winLength; n++) {
        audio[start + n] += ifftFrames[t][n];
        windowEnvelope[start + n] += windowSq[n];
      }
    }

    // Normalize and trim padding
    const trimmedLength = outputSize - 2 * pad;
    const trimmed = new Float32Array(trimmedLength);
    for (let i = 0; i < trimmedLength; i++) {
      const srcIdx = i + pad;
      if (windowEnvelope[srcIdx] > 1e-8) {
        trimmed[i] = audio[srcIdx] / windowEnvelope[srcIdx];
      } else {
        trimmed[i] = audio[srcIdx];
      }
    }

    return trimmed;
  }

  /**
   * Initialize Bluestein FFT for size n (any size, not just power of 2)
   */
  _initBluestein(n) {
    // Bluestein's algorithm: converts any-size FFT to power-of-2 FFT via convolution
    // FFT size for convolution: next power of 2 >= 2n - 1
    let m = 1;
    while (m < 2 * n - 1) m <<= 1;

    // Chirp sequence: W_n^(k^2/2) = exp(-πi * k² / n)
    const chirpRe = new Float32Array(n);
    const chirpIm = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const angle = Math.PI * k * k / n;
      chirpRe[k] = Math.cos(angle);
      chirpIm[k] = -Math.sin(angle);  // exp(-i*angle)
    }

    // Precompute FFT of chirp filter (b sequence)
    // b[k] = conj(chirp[k]) for k in [0, n-1]
    // b[m-k] = conj(chirp[k]) for k in [1, n-1]
    // conj(chirp[k]) = chirpRe[k] - i*chirpIm[k]
    const bRe = new Float32Array(m);
    const bIm = new Float32Array(m);
    bRe[0] = chirpRe[0];
    bIm[0] = -chirpIm[0];  // conjugate
    for (let k = 1; k < n; k++) {
      bRe[k] = chirpRe[k];
      bIm[k] = -chirpIm[k];  // conjugate
      bRe[m - k] = chirpRe[k];
      bIm[m - k] = -chirpIm[k];  // conjugate
    }

    // FFT of b (in-place)
    this._fftRadix2InPlace(bRe, bIm, m, false);

    // Precompute twiddle factors for radix-2 FFT of size m
    const twiddleRe = new Float32Array(m / 2);
    const twiddleIm = new Float32Array(m / 2);
    for (let i = 0; i < m / 2; i++) {
      const angle = -2 * Math.PI * i / m;
      twiddleRe[i] = Math.cos(angle);
      twiddleIm[i] = Math.sin(angle);
    }

    return { n, m, chirpRe, chirpIm, bRe, bIm, twiddleRe, twiddleIm };
  }

  /**
   * Bluestein FFT for any size
   */
  _bluesteinFFT(re, im, cache) {
    const { n, m, chirpRe, chirpIm, bRe, bIm, twiddleRe, twiddleIm } = cache;

    // a[k] = x[k] * chirp[k] for k in [0, n-1], zero-padded to m
    // chirp[k] = chirpRe[k] + i*chirpIm[k]
    // (re + i*im) * (chirpRe + i*chirpIm) = (re*chirpRe - im*chirpIm) + i*(im*chirpRe + re*chirpIm)
    const aRe = new Float32Array(m);
    const aIm = new Float32Array(m);
    for (let k = 0; k < n; k++) {
      aRe[k] = re[k] * chirpRe[k] - im[k] * chirpIm[k];
      aIm[k] = im[k] * chirpRe[k] + re[k] * chirpIm[k];
    }

    // FFT of a
    this._fftRadix2(aRe, aIm, twiddleRe, twiddleIm);

    // Pointwise multiply: a = a * b
    for (let k = 0; k < m; k++) {
      const tmpRe = aRe[k] * bRe[k] - aIm[k] * bIm[k];
      const tmpIm = aRe[k] * bIm[k] + aIm[k] * bRe[k];
      aRe[k] = tmpRe;
      aIm[k] = tmpIm;
    }

    // IFFT of a (using FFT with conjugate trick)
    for (let k = 0; k < m; k++) aIm[k] = -aIm[k];
    this._fftRadix2(aRe, aIm, twiddleRe, twiddleIm);
    for (let k = 0; k < m; k++) {
      aRe[k] /= m;
      aIm[k] = -aIm[k] / m;
    }

    // X[k] = chirp[k] * y[k]
    // Same multiplication as for a: (aRe + i*aIm) * (chirpRe + i*chirpIm)
    for (let k = 0; k < n; k++) {
      re[k] = aRe[k] * chirpRe[k] - aIm[k] * chirpIm[k];
      im[k] = aIm[k] * chirpRe[k] + aRe[k] * chirpIm[k];
    }
  }

  /**
   * In-place radix-2 FFT (Cooley-Tukey) with precomputed twiddles
   */
  _fftRadix2(re, im, twiddleRe, twiddleIm) {
    const n = re.length;

    // Bit-reversal permutation
    for (let i = 0, j = 0; i < n; i++) {
      if (i < j) {
        let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
        tmp = im[i]; im[i] = im[j]; im[j] = tmp;
      }
      let k = n >> 1;
      while (k > 0 && k <= j) { j -= k; k >>= 1; }
      j += k;
    }

    // Cooley-Tukey butterflies
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0; j < halfLen; j++) {
          const twIdx = j * step;
          const wRe = twiddleRe[twIdx];
          const wIm = twiddleIm[twIdx];
          const u = i + j;
          const v = u + halfLen;
          const tRe = wRe * re[v] - wIm * im[v];
          const tIm = wRe * im[v] + wIm * re[v];
          re[v] = re[u] - tRe;
          im[v] = im[u] - tIm;
          re[u] += tRe;
          im[u] += tIm;
        }
      }
    }
  }

  /**
   * In-place radix-2 FFT without precomputed twiddles (for initialization)
   */
  _fftRadix2InPlace(re, im, n, inverse = false) {
    // Bit-reversal
    for (let i = 0, j = 0; i < n; i++) {
      if (i < j) {
        let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
        tmp = im[i]; im[i] = im[j]; im[j] = tmp;
      }
      let k = n >> 1;
      while (k > 0 && k <= j) { j -= k; k >>= 1; }
      j += k;
    }

    // Butterflies
    const sign = inverse ? 1 : -1;
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const angle = sign * 2 * Math.PI / len;
      const wRe = Math.cos(angle);
      const wIm = Math.sin(angle);
      for (let i = 0; i < n; i += len) {
        let curRe = 1, curIm = 0;
        for (let j = 0; j < halfLen; j++) {
          const u = i + j;
          const v = u + halfLen;
          const tRe = curRe * re[v] - curIm * im[v];
          const tIm = curRe * im[v] + curIm * re[v];
          re[v] = re[u] - tRe;
          im[v] = im[u] - tIm;
          re[u] += tRe;
          im[u] += tIm;
          const newRe = curRe * wRe - curIm * wIm;
          curIm = curRe * wIm + curIm * wRe;
          curRe = newRe;
        }
      }
    }

    if (inverse) {
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
    }
  }

  /**
   * Free resources
   */
  dispose() {
    this.tokenizer = null;
    this.decoderSession = null;
    this.audioEncoderSession = null;
    this.audioEmbeddingSession = null;
    this.audioEmbeddingWeight = null;
    this.audioDetokenizerSession = null;
    this.vocoderSession = null;
    this.embedTokensWeight = null;
  }
}

// Re-export audio utilities
export { loadAudioFile };

export default AudioModel;
