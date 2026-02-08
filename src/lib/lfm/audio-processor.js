/**
 * Audio Processing for LFM2-Audio ONNX Runtime Web
 *
 * Computes mel spectrograms from audio input for the audio encoder.
 * Matches the Python compute_mel_spectrogram_numpy implementation.
 */

// Default mel config (matches mel_config.json)
const DEFAULT_MEL_CONFIG = {
  sample_rate: 16000,
  n_fft: 512,
  win_length: 400,
  hop_length: 160,
  n_mels: 128,
  fmin: 0,
  fmax: 8000,
  preemph: 0.97,
  log_zero_guard: 5.960464477539063e-08,
  normalize: 'per_feature',
  mel_norm: 'slaney',
};

let melConfig = { ...DEFAULT_MEL_CONFIG };
let melFilterbank = null;

/**
 * Load mel config from model path
 * @param {string} modelPath - Path to model directory
 */
export async function loadMelConfig(modelPath) {
  try {
    const response = await fetch(`${modelPath}/onnx/mel_config.json`, {
      mode: 'cors',
      credentials: 'omit',
    });
    if (response.ok) {
      melConfig = await response.json();
      console.log('Loaded mel config:', melConfig);
    }
  } catch (e) {
    console.warn('Could not load mel_config.json, using defaults');
  }

  // Pre-compute mel filterbank
  melFilterbank = createMelFilterbank(
    melConfig.sample_rate,
    melConfig.n_fft,
    melConfig.n_mels,
    melConfig.fmin,
    melConfig.fmax
  );
}

/**
 * Create mel filterbank matrix (simplified slaney normalization)
 * @param {number} sr - Sample rate
 * @param {number} nFft - FFT size
 * @param {number} nMels - Number of mel bands
 * @param {number} fmin - Minimum frequency
 * @param {number} fmax - Maximum frequency
 * @returns {Float32Array[]} - Mel filterbank [n_mels, n_fft/2+1]
 */
function createMelFilterbank(sr, nFft, nMels, fmin, fmax) {
  const nFreqs = Math.floor(nFft / 2) + 1;

  // Mel scale conversion functions
  const hzToMel = (hz) => 2595 * Math.log10(1 + hz / 700);
  const melToHz = (mel) => 700 * (Math.pow(10, mel / 2595) - 1);

  // Create mel points
  const melMin = hzToMel(fmin);
  const melMax = hzToMel(fmax);
  const melPoints = new Float32Array(nMels + 2);
  for (let i = 0; i < nMels + 2; i++) {
    melPoints[i] = melMin + (melMax - melMin) * i / (nMels + 1);
  }

  // Convert back to Hz and then to FFT bins
  const hzPoints = melPoints.map(melToHz);
  const binPoints = hzPoints.map((hz) => Math.floor((nFft + 1) * hz / sr));

  // Create filterbank
  const filterbank = [];
  for (let m = 0; m < nMels; m++) {
    const filter = new Float32Array(nFreqs);
    const start = binPoints[m];
    const center = binPoints[m + 1];
    const end = binPoints[m + 2];

    // Rising edge
    for (let k = start; k < center; k++) {
      if (k < nFreqs) {
        filter[k] = (k - start) / (center - start);
      }
    }
    // Falling edge
    for (let k = center; k < end; k++) {
      if (k < nFreqs) {
        filter[k] = (end - k) / (end - center);
      }
    }

    // Slaney normalization
    const enorm = 2.0 / (hzPoints[m + 2] - hzPoints[m]);
    for (let k = 0; k < nFreqs; k++) {
      filter[k] *= enorm;
    }

    filterbank.push(filter);
  }

  return filterbank;
}

/**
 * Create Hann window
 * @param {number} length - Window length
 * @returns {Float32Array} - Hann window
 */
function createHannWindow(length) {
  const window = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
  }
  return window;
}

/**
 * Resample audio to target sample rate (simple linear interpolation)
 * @param {Float32Array} audio - Input audio
 * @param {number} srcSr - Source sample rate
 * @param {number} dstSr - Target sample rate
 * @returns {Float32Array} - Resampled audio
 */
function resampleAudio(audio, srcSr, dstSr) {
  if (srcSr === dstSr) return audio;

  const ratio = srcSr / dstSr;
  const newLength = Math.floor(audio.length / ratio);
  const resampled = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const srcIdxFloor = Math.floor(srcIdx);
    const srcIdxCeil = Math.min(srcIdxFloor + 1, audio.length - 1);
    const frac = srcIdx - srcIdxFloor;
    resampled[i] = audio[srcIdxFloor] * (1 - frac) + audio[srcIdxCeil] * frac;
  }

  return resampled;
}

// === FFT Cache for Mel Spectrogram ===
let _fftCache = null;

/**
 * Initialize radix-2 FFT for a given size (must be power of 2)
 */
function initFFT(n) {
  if (_fftCache && _fftCache.n === n) return _fftCache;

  // Precompute twiddle factors
  const twiddleRe = new Float32Array(n / 2);
  const twiddleIm = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    const angle = -2 * Math.PI * i / n;
    twiddleRe[i] = Math.cos(angle);
    twiddleIm[i] = Math.sin(angle);
  }

  // Precompute bit-reversal permutation
  const bitrev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let j = 0;
    let x = i;
    for (let k = 1; k < n; k <<= 1) {
      j = (j << 1) | (x & 1);
      x >>= 1;
    }
    bitrev[i] = j;
  }

  // Reusable work arrays
  const workRe = new Float32Array(n);
  const workIm = new Float32Array(n);

  _fftCache = { n, twiddleRe, twiddleIm, bitrev, workRe, workIm };
  return _fftCache;
}

/**
 * Compute Real FFT magnitude using radix-2 Cooley-Tukey
 * @param {Float32Array} frame - Input frame (length must be power of 2)
 * @returns {Float32Array} - Magnitude spectrum [n/2+1]
 */
function computeRfftMagnitude(frame) {
  const n = frame.length;
  const nFreqs = Math.floor(n / 2) + 1;
  const cache = initFFT(n);

  const { twiddleRe, twiddleIm, bitrev, workRe, workIm } = cache;

  // Copy input with bit-reversal permutation
  for (let i = 0; i < n; i++) {
    workRe[bitrev[i]] = frame[i];
    workIm[bitrev[i]] = 0;
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
        const tRe = wRe * workRe[v] - wIm * workIm[v];
        const tIm = wRe * workIm[v] + wIm * workRe[v];
        workRe[v] = workRe[u] - tRe;
        workIm[v] = workIm[u] - tIm;
        workRe[u] += tRe;
        workIm[u] += tIm;
      }
    }
  }

  // Compute magnitude for positive frequencies
  const magnitude = new Float32Array(nFreqs);
  for (let k = 0; k < nFreqs; k++) {
    magnitude[k] = Math.sqrt(workRe[k] * workRe[k] + workIm[k] * workIm[k]);
  }

  return magnitude;
}

/**
 * Compute mel spectrogram from audio data
 * @param {Float32Array} audioData - Audio samples in [-1, 1]
 * @param {number} sampleRate - Audio sample rate
 * @returns {{melFeatures: Float32Array, numFrames: number}} - Mel features [time, n_mels]
 */
export function computeMelSpectrogram(audioData, sampleRate) {
  const {
    sample_rate: targetSr,
    n_fft: nFft,
    win_length: winLength,
    hop_length: hopLength,
    preemph,
    log_zero_guard: logZeroGuard,
    n_mels: nMels,
  } = melConfig;

  // Ensure filterbank is created
  if (!melFilterbank) {
    melFilterbank = createMelFilterbank(targetSr, nFft, nMels, melConfig.fmin, melConfig.fmax);
  }

  // 1. Resample to target sample rate
  let audio = resampleAudio(audioData, sampleRate, targetSr);

  // 2. Pre-emphasis filter: y[t] = x[t] - preemph * x[t-1]
  const audioPreemph = new Float32Array(audio.length);
  audioPreemph[0] = audio[0];
  for (let i = 1; i < audio.length; i++) {
    audioPreemph[i] = audio[i] - preemph * audio[i - 1];
  }

  // 3. Pad for center=True STFT
  const padAmount = Math.floor(nFft / 2);
  const audioPadded = new Float32Array(audio.length + 2 * padAmount);
  audioPadded.set(audioPreemph, padAmount);

  // 4. Frame the signal with windowing
  const numFrames = 1 + Math.floor((audioPadded.length - nFft) / hopLength);
  const nFreqs = Math.floor(nFft / 2) + 1;

  // Create window (centered in frame)
  const hannWindow = createHannWindow(winLength);
  const padLeft = Math.floor((nFft - winLength) / 2);
  const paddedWindow = new Float32Array(nFft);
  for (let i = 0; i < winLength; i++) {
    paddedWindow[padLeft + i] = hannWindow[i];
  }

  // 5. Compute STFT magnitude and mel spectrogram
  const melFeatures = new Float32Array(numFrames * nMels);

  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    // Extract and window frame
    const start = frameIdx * hopLength;
    const frame = new Float32Array(nFft);
    for (let i = 0; i < nFft; i++) {
      frame[i] = audioPadded[start + i] * paddedWindow[i];
    }

    // Compute magnitude spectrum
    const magnitude = computeRfftMagnitude(frame);

    // Apply mel filterbank
    for (let m = 0; m < nMels; m++) {
      let melVal = 0;
      for (let k = 0; k < nFreqs; k++) {
        melVal += melFilterbank[m][k] * magnitude[k] * magnitude[k]; // Power spectrum
      }
      // Log mel with guard
      melFeatures[frameIdx * nMels + m] = Math.log(Math.max(melVal, logZeroGuard));
    }
  }

  // 6. Per-feature normalization (if enabled)
  if (melConfig.normalize === 'per_feature') {
    for (let m = 0; m < nMels; m++) {
      let mean = 0;
      let std = 0;
      for (let t = 0; t < numFrames; t++) {
        mean += melFeatures[t * nMels + m];
      }
      mean /= numFrames;

      for (let t = 0; t < numFrames; t++) {
        const diff = melFeatures[t * nMels + m] - mean;
        std += diff * diff;
      }
      std = Math.sqrt(std / numFrames + 1e-5);

      for (let t = 0; t < numFrames; t++) {
        melFeatures[t * nMels + m] = (melFeatures[t * nMels + m] - mean) / std;
      }
    }
  }

  return { melFeatures, numFrames };
}

/**
 * Load audio file and decode to Float32Array
 * @param {File|Blob} file - Audio file
 * @returns {Promise<{audioData: Float32Array, sampleRate: number}>}
 */
export async function loadAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get mono audio (average channels if stereo)
    let audioData;
    if (audioBuffer.numberOfChannels === 1) {
      audioData = audioBuffer.getChannelData(0);
    } else {
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = audioBuffer.getChannelData(1);
      audioData = new Float32Array(ch0.length);
      for (let i = 0; i < ch0.length; i++) {
        audioData[i] = (ch0[i] + ch1[i]) / 2;
      }
    }

    return {
      audioData: new Float32Array(audioData), // Copy to avoid detached buffer issues
      sampleRate: audioBuffer.sampleRate,
    };
  } finally {
    audioContext.close();
  }
}

/**
 * Record audio from microphone
 * @param {number} maxDurationMs - Maximum recording duration in ms
 * @returns {Promise<{audioData: Float32Array, sampleRate: number}>}
 */
export async function recordAudio(maxDurationMs = 30000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      try {
        const result = await loadAudioFile(blob);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };

    mediaRecorder.onerror = (e) => {
      stream.getTracks().forEach((track) => track.stop());
      reject(e);
    };

    mediaRecorder.start();

    // Auto-stop after max duration
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, maxDurationMs);
  });
}

export { melConfig };
