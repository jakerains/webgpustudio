# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build — use to verify TypeScript + no errors
npm run lint         # ESLint
```

No test framework is configured. Use `npm run build` as the primary correctness check.

## Architecture

WebGPU Studio is a Next.js 16 App Router app that runs ML models entirely in the browser via WebGPU. There are 12 feature routes plus a landing page, each following the same layered pattern:

```
Constants (model registry) → Web Worker (inference) → Hook (bridge) → Page (UI)
```

### The Four Layers

**1. Model Registry** (`src/lib/*-constants.ts`)
Each feature has a constants file exporting a `MODEL_OPTIONS` array. Adding a new model means adding an entry to this array — no other changes needed for the model to appear in the UI dropdown.

**2. Web Worker** (`src/app/{feature}/*-worker.ts`)
Workers run `@huggingface/transformers` inference off the main thread. They use a singleton pattern: cache the model instance globally, reload only when `modelId` or `dtype` changes. Workers communicate via `postMessage` with typed messages: `load`, `initiate`, `progress`, `done`, `ready`, `result/complete`, `error`.

**3. Hook Bridge** (`src/hooks/use*.ts`)
Custom hooks create the Worker in a `useEffect`, wire up the `onmessage` handler to React state, and expose callback functions (`loadModel`, `execute`, etc.) that call `worker.postMessage`. Progress items use the shape `{file, progress, loaded, total, status}`.

**4. Page** (`src/app/{feature}/page.tsx`)
All pages are `"use client"`. Standard layout: `max-w-2xl mx-auto px-5 py-10 sm:py-14`. Each page uses its hook, checks WebGPU support via `useWebGPUSupport()`, and renders feature-specific UI with shared components.

### Critical Constraints

- **Workers cannot use path aliases** (`@/`). Inline constants or use relative imports in worker files.
- **`@huggingface/transformers` dtype** requires a specific string union type cast, not plain `string` — e.g., `dtype as "q4f16"`.
- **`sharp` and `onnxruntime-node`** are aliased to an empty module in `next.config.ts` to prevent Node.js-only import errors.
- **Worker URLs** must use `new URL("../path/to/worker.ts", import.meta.url)` with `{ type: "module" }`.
- **Sidebar offset**: Main content uses `lg:ml-[260px]` + `pt-14 lg:pt-0` (set in root layout). Don't add extra offsets in pages.
- **Particle simulator** uses raw WebGPU compute shaders (WGSL), NOT transformers.js.

### Design System

- **Tailwind 4** with no config file — theme defined via CSS variables in `src/app/globals.css`
- **All colors** use CSS variables: `var(--accent)`, `var(--foreground)`, `var(--muted)`, etc. Never hardcode hex values in components.
- **Fonts**: DM Sans (body), Bricolage Grotesque (display via `--font-display`), JetBrains Mono (code via `--font-mono`), Geist Pixel Square (hero title via `--font-pixel`). Set up in `src/app/layout.tsx`.
- **Shared components** in `src/components/shared/`: `ImageDropzone`, `WebcamView`, `ComparisonSlider`, `AudioPlayer`, `PerformanceDisplay`.
- Audio features use `float32ToWav()` from `src/lib/canvas-utils.ts`.

### Adding a New Feature

1. Create `src/lib/{feature}-constants.ts` with model array
2. Create `src/app/{feature}/{feature}-worker.ts` with singleton pattern
3. Create `src/hooks/use{Feature}.ts` bridging worker to React
4. Create `src/app/{feature}/page.tsx` (use client)
5. Add navigation entry to `NAV_CATEGORIES` in `src/components/Sidebar.tsx`
6. Add card to the relevant `CategorySection` on the landing page (`src/app/page.tsx`)

### Versioning

`src/lib/version.ts` is the single source of truth for `APP_VERSION` and `CHANGELOG`. The landing page footer displays the version and opens a changelog modal on click.

**Before every commit and push**, you must:

1. Review all changes being committed (via `git diff`)
2. Bump the version in `src/lib/version.ts` (`APP_VERSION`) and `package.json`
   - **Patch** (0.5.0 → 0.5.1): bug fixes, styling tweaks, copy changes, small additions — this is the default for most work
   - **Minor** (0.5.0 → 0.6.0): new features, new routes/pages, significant new functionality, major redesigns
3. Add a new entry to the top of the `CHANGELOG` array in `src/lib/version.ts` with today's date, a short title, and the list of changes with their types (`added`, `improved`, `fixed`, `changed`)

## Feature Status Tracker

Each WebGPU experiment's current tested status. Update this list as features are fixed or tested.

| Route | Feature | Status | Notes |
|---|---|---|---|
| `/chat` | WebGPU Chat (LLMs) | ✅ Working | |
| `/speech-to-text` | Whisper Speech-to-Text | ✅ Working | |
| `/background-removal` | RMBG Background Removal | ✅ Working | |
| `/object-detection` | YOLOS/DETR Object Detection | ✅ Working | |
| `/music-generation` | MusicGen Text-to-Music | ❌ Broken | |
| `/image-segmentation` | Segment Anything (SAM) | ⚠️ Partial | Sort of works, needs fixes |
| `/semantic-search` | MiniLM Semantic Search | ⚠️ Partial | Needs work |
| `/particle-simulator` | WebGPU Particle Simulator | ⚠️ Partial | Works but needs polish |
| `/depth-estimation` | Depth Anything V2 | 🔘 Untested | |
| `/text-to-speech` | SpeechT5 TTS | 🔘 Untested | |
| `/lfm-audio` | LFM Audio Studio | 🔘 Untested | |
| `/vision-chat` | SmolVLM Vision Chat | 🔘 Untested | |
| `/translation` | NLLB-200 Translation | 🔘 Untested | |

**Legend:** ✅ Working — ⚠️ Partial (needs fixes) — ❌ Broken — 🔘 Untested

## Model Names

**Never change model names during debugging.** Model IDs (e.g., `onnx-community/sam3-tracker-ONNX`, `LiquidAI/LFM2.5-1.2B-Instruct-ONNX`) are valid HuggingFace Hub identifiers even if unrecognized. Assume model names are correct and never the source of bugs.
