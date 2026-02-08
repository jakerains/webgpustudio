"use client";

import { useState, useEffect } from "react";

interface WebGPUInfo {
  isSupported: boolean;
  isChecking: boolean;
  adapterInfo: GPUAdapterInfo | null;
}

export function useWebGPUSupport(): WebGPUInfo {
  const [isSupported, setIsSupported] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [adapterInfo, setAdapterInfo] = useState<GPUAdapterInfo | null>(null);

  useEffect(() => {
    async function checkWebGPU() {
      try {
        if (!navigator.gpu) {
          setIsSupported(false);
          setIsChecking(false);
          return;
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          setIsSupported(true);
          setAdapterInfo(adapter.info);
        } else {
          setIsSupported(false);
        }
      } catch {
        setIsSupported(false);
      } finally {
        setIsChecking(false);
      }
    }
    checkWebGPU();
  }, []);

  return { isSupported, isChecking, adapterInfo };
}
