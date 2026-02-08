"use client";

import { useEffect } from "react";
import { Header } from "@/components/Header";
import { ModelSetup } from "@/components/ModelSetup";
import { TranscriptionPanel } from "@/components/TranscriptionPanel";
import { useTranscriber } from "@/hooks/useTranscriber";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useWebGPUSupport } from "@/hooks/useWebGPUSupport";

export default function Home() {
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
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
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
          isWebGPUSupported={isWebGPUSupported}
          onDeviceChange={transcriber.setDevice}
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

        <footer className="mt-8 text-center">
          <p className="text-xs text-gray-600">
            Powered by{" "}
            <span className="text-gray-500">Transformers.js</span> &{" "}
            <span className="text-gray-500">Whisper</span> — All processing
            happens locally in your browser
          </p>
        </footer>
      </div>
    </main>
  );
}
