"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Image as ImageIcon, X } from "lucide-react";

interface ImageDropzoneProps {
  onImageSelect: (imageDataUrl: string) => void;
  currentImage?: string | null;
  onClear?: () => void;
  accept?: string;
  maxSizeMB?: number;
}

export function ImageDropzone({
  onImageSelect,
  currentImage,
  onClear,
  accept = "image/*",
  maxSizeMB = 20,
}: ImageDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
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

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) onImageSelect(result);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect, maxSizeMB]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (currentImage) {
    return (
      <div className="relative rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
        <img
          src={currentImage}
          alt="Uploaded"
          className="w-full max-h-[400px] object-contain"
          style={{ background: "var(--surface)" }}
        />
        {onClear && (
          <button
            onClick={onClear}
            className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <X className="w-4 h-4" style={{ color: "var(--muted)" }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="cursor-pointer rounded-2xl p-8 flex flex-col items-center gap-3 transition-all"
        style={{
          background: isDragOver ? "var(--accent-bg)" : "var(--surface)",
          border: `2px dashed ${isDragOver ? "var(--accent)" : "var(--border-subtle)"}`,
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: isDragOver ? "var(--accent)" : "var(--card)",
            border: isDragOver ? "none" : "1px solid var(--border-subtle)",
          }}
        >
          {isDragOver ? (
            <ImageIcon className="w-6 h-6 text-white" />
          ) : (
            <Upload className="w-6 h-6" style={{ color: "var(--muted)" }} />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: isDragOver ? "var(--accent)" : "var(--foreground)" }}>
            {isDragOver ? "Drop image here" : "Drop an image or click to upload"}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-light)" }}>
            PNG, JPG, WebP up to {maxSizeMB}MB
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
      {error && (
        <p className="text-xs mt-2" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
