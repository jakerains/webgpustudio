export const APP_VERSION = "0.5.1";

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
