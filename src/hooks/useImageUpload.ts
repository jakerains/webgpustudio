"use client";

import { useState, useRef, useCallback } from "react";

interface ImageUploadState {
  imageDataUrl: string | null;
  fileName: string | null;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  handlePaste: (e: ClipboardEvent) => void;
  clear: () => void;
  setImageFromUrl: (url: string) => void;
}

export function useImageUpload(maxSizeMB = 20): ImageUploadState {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`Image must be under ${maxSizeMB}MB`);
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) setImageDataUrl(result);
      };
      reader.readAsDataURL(file);
    },
    [maxSizeMB]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    },
    [processFile]
  );

  const clear = useCallback(() => {
    setImageDataUrl(null);
    setFileName(null);
    setError(null);
  }, []);

  const setImageFromUrl = useCallback((url: string) => {
    setImageDataUrl(url);
    setFileName(null);
    setError(null);
  }, []);

  return {
    imageDataUrl,
    fileName,
    error,
    inputRef,
    handleFileSelect,
    handleDrop,
    handlePaste,
    clear,
    setImageFromUrl,
  };
}
