<div align="center">

<img src=".github/header.png" alt="WebGPU Studio" width="700" />

<br />

No servers. No API keys. No data leaves your device.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Live Demo](https://webgpu.studio) &nbsp;&middot;&nbsp; [Report Bug](https://github.com/jakerains/webgpustudio/issues) &nbsp;&middot;&nbsp; [Request Feature](https://github.com/jakerains/webgpustudio/issues)

</div>

---

## What is this?

WebGPU Studio is an open-source collection of **8 AI-powered tools** that run completely client-side using [WebGPU](https://www.w3.org/TR/webgpu/) acceleration. Models are downloaded once from [Hugging Face Hub](https://huggingface.co/) and cached in your browser — after that, everything works offline.

Built with [`@huggingface/transformers`](https://huggingface.co/docs/transformers.js) for ML inference, [`kokoro-js`](https://github.com/niconielsen32/kokoro-js) and [`onnxruntime-web`](https://onnxruntime.ai/) for TTS, and raw WebGPU compute shaders for GPU-native features.

## Features

### Speech & Audio
| Feature | Description | Models | Size |
|---------|-------------|--------|------|
| **Speech to Text** | Real-time transcription from mic or audio files | OpenAI Whisper (6 variants incl. Large V3 Turbo) | 39 MB - 1.5 GB |
| **Text to Speech** | Convert text to natural-sounding speech | Kokoro, Kitten TTS, Supertonic, LFM2.5, OuteTTS | 24 MB - 1.5 GB |

### Vision & Image
| Feature | Description | Models | Size |
|---------|-------------|--------|------|
| **Background Removal** | Instantly remove image backgrounds | RMBG | 44-200 MB |
| **Object Detection** | Real-time detection with webcam or upload | YOLOv10 / YOLOS / DETR / Grounding DINO | 8-166 MB |
| **Depth Estimation** | Generate depth maps from 2D images | Depth Anything V2 | ~97 MB |
| **Image Segmentation** | Click-to-segment with point prompts, multi-mask & negative points | Meta SAM3 / SlimSAM | ~301 MB |

### Text & Language
| Feature | Description | Models | Size |
|---------|-------------|--------|------|
| **Chat** | Conversational AI with streaming & thinking | Qwen3 / Llama 3.2 / LFM 2.5 / LFM2 / SmolLM3 (7 models) | 570 MB - 2.8 GB |

### GPU Compute
| Feature | Description | Size |
|---------|-------------|------|
| **Particle Simulator** | 10k+ particle physics via raw WebGPU compute shaders (WGSL) | No model |

All vision features support **webcam capture** in addition to file upload.

## Requirements

- A browser with [WebGPU support](https://caniuse.com/webgpu) (Chrome 113+, Edge 113+, or Firefox Nightly)
- Falls back to WASM for some features when WebGPU is unavailable

## Getting Started

```bash
# Clone the repo
git clone https://github.com/jakerains/webgpustudio.git
cd webgpustudio

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| UI | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| ML Inference | [`@huggingface/transformers`](https://huggingface.co/docs/transformers.js), [`kokoro-js`](https://github.com/niconielsen32/kokoro-js), [`onnxruntime-web`](https://onnxruntime.ai/) via Web Workers |
| GPU Compute | [WebGPU API](https://www.w3.org/TR/webgpu/) + [WGSL](https://www.w3.org/TR/WGSL/) shaders |
| Typography | [DM Sans](https://fonts.google.com/specimen/DM+Sans), [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), [Geist Pixel](https://vercel.com/font) |
| Icons | [Lucide React](https://lucide.dev/) |

## Architecture

Every feature follows the same four-layer pattern:

```
Model Registry (constants) → Web Worker (inference) → Hook (bridge) → Page (UI)
```

- **Model registries** are plain arrays in `src/lib/*-constants.ts` — adding a model is adding an array entry
- **Web Workers** run inference off the main thread with a singleton cache pattern
- **Custom hooks** bridge worker messages to React state
- **Pages** are `"use client"` components that compose hooks + shared UI

All inference runs in Web Workers so the UI never freezes during model loading or inference.

## Project Structure

```
src/
  app/
    page.tsx                    # Landing page
    layout.tsx                  # Root layout (fonts, sidebar)
    globals.css                 # Design system (CSS variables)
    {feature}/
      page.tsx                  # Feature page
      {feature}-worker.ts       # Web Worker for inference
  components/
    shared/                     # Reusable: ImageDropzone, WebcamView, AudioPlayer, etc.
    {feature}/                  # Feature-specific components
    Sidebar.tsx                 # Navigation
    ChangelogModal.tsx          # Version history modal
  hooks/
    use{Feature}.ts             # Worker ↔ React bridge per feature
  lib/
    {feature}-constants.ts      # Model registries
    version.ts                  # App version + changelog data
    canvas-utils.ts             # Image/audio conversion utilities
    particle-engine.ts          # Raw WebGPU compute engine
    particle-shaders.ts         # WGSL shader source
```

## Contributing

Contributions are welcome! The easiest way to add value:

1. **Add a new model** — just add an entry to the relevant constants file in `src/lib/`
2. **Add a new feature** — follow the four-layer pattern above
3. **Fix bugs or improve UX** — open an issue first so we can discuss

## License

MIT

---

<div align="center">
<sub>Built with WebGPU. All processing happens locally — no data leaves your device.</sub>
</div>
