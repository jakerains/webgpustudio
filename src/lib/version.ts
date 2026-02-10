export const APP_VERSION = "0.10.1";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: {
    type: "added" | "improved" | "fixed" | "changed";
    text: string;
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.10.1",
    date: "2026-02-10",
    title: "Model Caching & Settings Page",
    changes: [
      { type: "added", text: "Settings page with model cache management — view cached models and clear storage" },
      { type: "added", text: "Cache detection across all features — see which models are already downloaded" },
      { type: "improved", text: "All 8 feature hooks now track cached model status for instant load indicators" },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-02-10",
    title: "Audio Intelligence with Voxtral Mini 3B",
    changes: [
      { type: "added", text: "Audio Intelligence — transcribe, summarize, and ask questions about audio using Voxtral Mini 3B (~2 GB)" },
      { type: "added", text: "Multimodal audio-text model with streaming responses and conversation history" },
      { type: "added", text: "Audio input via file upload (WAV, MP3, OGG, FLAC, WebM) or microphone recording" },
      { type: "added", text: "Quick-action suggestion chips: Transcribe (EN/ES), Describe, Summarize, Language Detection" },
    ],
  },
  {
    version: "0.9.6",
    date: "2026-02-10",
    title: "DeepSeek-R1 Chat + Smarter System Prompt",
    changes: [
      { type: "added", text: "DeepSeek-R1 Distill Qwen 1.5B — reasoning model for chat via ONNX" },
      { type: "improved", text: "Chat system prompt now describes WebGPU Studio context and capabilities" },
      { type: "changed", text: "Background removal swapped RMBG 2.0 for MODNet (~25 MB, portrait-focused)" },
    ],
  },
  {
    version: "0.9.5",
    date: "2026-02-08",
    title: "TTS Overhaul + Expanded Chat Models",
    changes: [
      { type: "added", text: "Kitten TTS Nano — ultra-lightweight 15M param TTS with 8 expressive voices (~24 MB)" },
      { type: "added", text: "Kokoro TTS set as default model with Sky voice — highest quality browser TTS" },
      { type: "fixed", text: "Kokoro TTS audio corruption — switched from WebGPU to WASM backend" },
      { type: "improved", text: "Voice selector resets to correct default when switching TTS models" },
      { type: "changed", text: "Text to Speech promoted from WIP to Beta" },
      { type: "added", text: "Llama 3.2 (1B), Qwen3 (1.7B), LFM2 (2.6B), Qwen3 (4B) chat models" },
      { type: "added", text: "Switch model button in chat — change models without refreshing the page" },
    ],
  },
  {
    version: "0.9.4",
    date: "2026-02-08",
    title: "Kokoro & Supertonic TTS",
    changes: [
      { type: "added", text: "Kokoro TTS v1.0 — highest quality browser TTS with 30+ voices and natural prosody (82M params, ~92 MB)" },
      { type: "added", text: "Supertonic TTS v2 — ultra-fast speech synthesis at 167x real-time speed (66M params, ~263 MB)" },
      { type: "added", text: "Voice selector for Kokoro with 16 voices across American & British accents" },
      { type: "added", text: "Male/Female speaker selection for Supertonic TTS" },
      { type: "improved", text: "TTS worker refactored with engine-based routing for 4 model backends (Kokoro, Supertonic, LFM, OuteTTS)" },
    ],
  },
  {
    version: "0.9.3",
    date: "2026-02-08",
    title: "YOLOv10 & Grounding DINO Detection",
    changes: [
      { type: "added", text: "YOLOv10 Nano/Small/Medium models — fast, accurate COCO object detection" },
      { type: "added", text: "Grounding DINO Tiny — open-vocabulary detection with custom text labels" },
      { type: "added", text: "Search labels input for Grounding DINO — type any object to detect" },
      { type: "improved", text: "Worker refactored for 3 pipeline types: standard, YOLOv10 (AutoModel), and zero-shot" },
    ],
  },
  {
    version: "0.9.2",
    date: "2026-02-08",
    title: "Image Segmentation Overhaul",
    changes: [
      { type: "added", text: "Multi-mask granularity selector — choose between Precise, Balanced, and Broad masks" },
      { type: "added", text: "SlimSAM (Xenova) lightweight model option (~107 MB vs SAM3's ~301 MB)" },
      { type: "added", text: "Right-click to place negative points that exclude regions from segmentation" },
      { type: "improved", text: "Mask visualization with dimmed background, edge contours, and subtle color fill" },
      { type: "improved", text: "Click points now show + (include) and x (exclude) icons with blue/red colors" },
      { type: "fixed", text: "SAM1 mask threshold bug — raw float logits now properly binarized" },
      { type: "fixed", text: "All SAM masks returned sorted by confidence instead of only showing one" },
    ],
  },
  {
    version: "0.9.1",
    date: "2026-02-08",
    title: "Realtime Speech-to-Text",
    changes: [
      { type: "added", text: "Realtime transcription mode — live, streaming speech-to-text as you speak" },
      { type: "added", text: "Token-by-token streaming via TextStreamer with tokens/second display" },
      { type: "added", text: "Standard/Realtime mode toggle on the Speech to Text page" },
      { type: "added", text: "Language selector for realtime mode (19 languages)" },
      { type: "improved", text: "WebGPU shader warmup on model load for faster first transcription" },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-02-08",
    title: "Feature Curation & Model Upgrades",
    changes: [
      { type: "changed", text: "Removed Translation, Music Generation, LFM Audio Studio, and Semantic Search (redundant or broken)" },
      { type: "fixed", text: "Depth Estimation now uses correct ONNX model (onnx-community/depth-anything-v2-small)" },
      { type: "added", text: "Depth Anything V2 Base model option for higher quality depth maps" },
      { type: "added", text: "Whisper Large V3 Turbo model option for best-in-class speech recognition" },
      { type: "changed", text: "Removed legacy SpeechT5 TTS model — LFM2.5 Audio and OuteTTS remain" },
      { type: "changed", text: "Removed SAM1 (Xenova) from segmentation — SAM3 is the only option now" },
      { type: "improved", text: "Streamlined from 12 features to 8 focused, working experiments" },
    ],
  },
  {
    version: "0.8.1",
    date: "2026-02-08",
    title: "Per-Model Chat Config & Brand Consistency",
    changes: [
      { type: "added", text: "Per-model generation config for chat (do_sample, temperature, repetition_penalty)" },
      { type: "improved", text: "Sidebar and mobile header logo now matches hero pixel font and accent color treatment" },
      { type: "improved", text: "Chat model interface supports future multimodal and multi-component dtype models" },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-02-08",
    title: "OuteTTS TTS & Feature Status Badges",
    changes: [
      { type: "added", text: "OuteTTS v0.2 (500M) — multi-language TTS with male/female/random speaker profiles" },
      { type: "added", text: "Speaker voice selector dropdown for OuteTTS model" },
      { type: "added", text: "BETA and WIP status badges on feature cards and sidebar navigation" },
      { type: "improved", text: "TTS page now handles both raw PCM and pre-encoded WAV audio formats" },
      { type: "improved", text: "Landing page cards show feature maturity status (working, experimental, broken)" },
    ],
  },
  {
    version: "0.7.1",
    date: "2026-02-08",
    title: "Mobile Notice & Slider Fix",
    changes: [
      { type: "added", text: "Mobile visitors see a friendly 'Best on Desktop' notice instead of the feature grid" },
      { type: "fixed", text: "Comparison slider no longer resizes the original image when dragging" },
      { type: "added", text: "Feature status tracker in CLAUDE.md for tracking experiment health" },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-02-08",
    title: "WebGPU.Studio Rebrand",
    changes: [
      { type: "changed", text: "Rebranded to WebGPU.Studio across hero, sidebar, metadata, and navigation" },
      { type: "added", text: "Custom GPU favicon matching the hero icon (replaces default Next.js favicon)" },
      { type: "added", text: "Footer with GitHub link, version badge, and Jake Rains attribution" },
      { type: "changed", text: "Updated domain to webgpu.studio in all metadata and README links" },
    ],
  },
  {
    version: "0.6.1",
    date: "2026-02-08",
    title: "Open Graph & Social Previews",
    changes: [
      { type: "added", text: "Open Graph meta tags for rich link previews on social media, Slack, and Discord" },
      { type: "added", text: "Twitter card with summary_large_image for full-width previews" },
      { type: "added", text: "OG image screenshot of landing page at 1200x630" },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-02-08",
    title: "LFM Audio Upgrade",
    changes: [
      { type: "improved", text: "Text-to-speech now defaults to LFM2.5 Audio with SpeechT5 fallback support" },
      { type: "fixed", text: "SpeechT5 synthesis now provides explicit speaker embeddings for reliable output" },
      { type: "added", text: "New LFM Audio Studio demo with ASR, TTS, and near-real-time interleaved mode" },
      { type: "added", text: "LFM audio route is available in sidebar navigation and landing-page speech category" },
    ],
  },
  {
    version: "0.5.3",
    date: "2026-02-08",
    title: "README Header Image",
    changes: [
      { type: "added", text: "Geist Pixel header image for GitHub README" },
      { type: "improved", text: "README uses rendered header with pixel font, GPU icon, and feature badges" },
    ],
  },
  {
    version: "0.5.2",
    date: "2026-02-08",
    title: "README & Repo Rename",
    changes: [
      { type: "added", text: "Comprehensive README with feature tables, architecture guide, and tech stack" },
      { type: "changed", text: "Repository renamed from whispergpu to webgpustudio" },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-02-08",
    title: "Developer Docs",
    changes: [
      { type: "added", text: "CLAUDE.md with architecture guide and development conventions" },
      { type: "improved", text: "Auto version bumping and changelog updates before each commit" },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-02-08",
    title: "Featured Section & Webcam Everywhere",
    changes: [
      { type: "added", text: "Featured section on landing page highlighting top experiences" },
      { type: "added", text: "Webcam capture support on all image-based features" },
      { type: "added", text: "SAM3 (Meta) support for image segmentation with q4f16 quantization" },
      { type: "added", text: "Version display with changelog modal" },
      { type: "improved", text: "Landing page design with animated featured cards and gradient borders" },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-02-07",
    title: "Full Feature Suite",
    changes: [
      { type: "added", text: "Image Segmentation — click-to-segment with Segment Anything" },
      { type: "added", text: "Vision Chat — upload images and ask questions with SmolVLM" },
      { type: "added", text: "Text to Speech — SpeechT5 text-to-voice synthesis" },
      { type: "added", text: "Music Generation — MusicGen text-to-music" },
      { type: "added", text: "Semantic Search — MiniLM embedding-based document search" },
      { type: "added", text: "Translation — NLLB-200 supporting 200 languages" },
      { type: "added", text: "Particle Simulator — raw WebGPU compute shader physics" },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-02-06",
    title: "Vision Features",
    changes: [
      { type: "added", text: "Background Removal with RMBG models" },
      { type: "added", text: "Object Detection with YOLOS/DETR and real-time webcam" },
      { type: "added", text: "Depth Estimation with Depth Anything V2" },
      { type: "added", text: "Sidebar navigation with collapsible category sections" },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-02-05",
    title: "Chat & Design System",
    changes: [
      { type: "added", text: "WebGPU chat with LLMs — streaming responses and thinking support" },
      { type: "changed", text: "Complete UI redesign with warm, professional theme" },
      { type: "added", text: "Model size selector for Whisper variants" },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-02-04",
    title: "Initial Release",
    changes: [
      { type: "added", text: "Speech-to-text with OpenAI Whisper running via WebGPU" },
      { type: "added", text: "Web Worker architecture for non-blocking inference" },
      { type: "added", text: "Progress tracking for model downloads" },
    ],
  },
];
