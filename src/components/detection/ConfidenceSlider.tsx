"use client";

interface ConfidenceSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function ConfidenceSlider({
  value,
  onChange,
  min = 0.1,
  max = 0.9,
  step = 0.05,
}: ConfidenceSliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          className="text-xs font-medium"
          style={{ color: "var(--muted)" }}
        >
          Confidence Threshold
        </label>
        <span
          className="text-xs font-mono font-medium"
          style={{ color: "var(--foreground)" }}
        >
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${
            ((value - min) / (max - min)) * 100
          }%, var(--border-subtle) ${
            ((value - min) / (max - min)) * 100
          }%, var(--border-subtle) 100%)`,
          accentColor: "var(--accent)",
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: "var(--muted-light)" }}>
          More detections
        </span>
        <span className="text-[10px]" style={{ color: "var(--muted-light)" }}>
          Higher confidence
        </span>
      </div>
    </div>
  );
}
