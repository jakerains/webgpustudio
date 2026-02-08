export type ParticlePalette = "ink" | "sand" | "ember";

export interface ParticlePresetParams {
  friction: number;
  flowStrength: number;
  flowScale: number;
  swirlStrength: number;
  pointerStrength: number;
  pointerRadius: number;
  sizeBase: number;
  speedLimit: number;
  trailFade: number;
  palette: ParticlePalette;
}

export interface ParticlePreset {
  id: string;
  label: string;
  params: ParticlePresetParams;
}

export const PARTICLE_PRESETS: ParticlePreset[] = [
  {
    id: "ink-drift",
    label: "Ink Drift",
    params: {
      friction: 0.987,
      flowStrength: 26,
      flowScale: 0.0026,
      swirlStrength: 20,
      pointerStrength: 900,
      pointerRadius: 220,
      sizeBase: 2.4,
      speedLimit: 420,
      trailFade: 0.1,
      palette: "ink",
    },
  },
  {
    id: "sandstorm",
    label: "Sandstorm",
    params: {
      friction: 0.98,
      flowStrength: 40,
      flowScale: 0.0034,
      swirlStrength: 10,
      pointerStrength: 1100,
      pointerRadius: 260,
      sizeBase: 2.0,
      speedLimit: 520,
      trailFade: 0.08,
      palette: "sand",
    },
  },
  {
    id: "ember-bloom",
    label: "Ember Bloom",
    params: {
      friction: 0.99,
      flowStrength: 18,
      flowScale: 0.002,
      swirlStrength: 28,
      pointerStrength: 800,
      pointerRadius: 200,
      sizeBase: 2.8,
      speedLimit: 360,
      trailFade: 0.13,
      palette: "ember",
    },
  },
];

export const getParticlePreset = (id: string): ParticlePreset => {
  return PARTICLE_PRESETS.find((preset) => preset.id === id) ?? PARTICLE_PRESETS[0];
};
