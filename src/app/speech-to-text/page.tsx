"use client";

import { useEffect } from "react";
import { Header } from "@/components/Header";
import { ModelSetup } from "@/components/ModelSetup";
import { TranscriptionPanel } from "@/components/TranscriptionPanel";
import { useTranscriber } from "@/hooks/useTranscriber";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";

export default function SpeechToTextPage() {
  const { isSupported: isWebGPUSupported, isChecking: isCheckingWebGPU } =
    useWebGPUSupport();

  const transcriber = useTranscriber();
  const recorder = useAudioRecorder();

  // Auto-set device based on WebGPU support
  useEffect(() => {
    if (!isCheckingWebGPU && !isWebGPUSupported) {
      transcriber.setDevice("wasm");
    }
  }, [isCheckingWebGPU, isWebGPUSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartRecording = async () => {
    await recorder.startRecording();
  };

  const handleStopRecording = async () => {
    const audio = await recorder.stopRecording();
    if (audio) {
      transcriber.transcribe(audio);
    }
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        <Header
          isWebGPUSupported={isWebGPUSupported}
          isCheckingWebGPU={isCheckingWebGPU}
        />

        <ModelSetup
          isModelLoading={transcriber.isModelLoading}
          isModelReady={transcriber.isModelReady}
          progressItems={transcriber.progressItems}
          error={transcriber.error}
          device={transcriber.device}
          modelId={transcriber.modelId}
          isWebGPUSupported={isWebGPUSupported}
          onDeviceChange={transcriber.setDevice}
          onModelChange={transcriber.setModelId}
          onLoadModel={transcriber.loadModel}
        />

        <TranscriptionPanel
          isModelReady={transcriber.isModelReady}
          isRecording={recorder.isRecording}
          isTranscribing={transcriber.isTranscribing}
          duration={recorder.duration}
          transcript={transcriber.transcript}
          audioError={recorder.error}
          analyserNode={recorder.analyserNode}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />

        <footer className="mt-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
            <span>Powered by</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Transformers.js</span>
            <span>&</span>
            <span className="font-medium" style={{ color: "var(--foreground)" }}>Whisper</span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            All processing happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
