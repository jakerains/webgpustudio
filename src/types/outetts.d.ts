declare module "outetts" {
  export class HFModelConfig_v1 {
    constructor(config: {
      model_path?: string;
      language?: string;
      tokenizer_path?: string | null;
      languages?: string[];
      verbose?: boolean;
      device?: string | null;
      dtype?: string | null;
      additional_model_config?: Record<string, unknown>;
      wavtokenizer_model_path?: string | null;
      max_seq_length?: number;
    });
    model_path: string;
    language: string;
    tokenizer_path: string | null;
    languages: string[];
    verbose: boolean;
    device: string | null;
    dtype: string | null;
    max_seq_length: number;
  }

  export interface ModelOutput {
    audio: unknown;
    sr: number;
    to_wav(): ArrayBuffer;
    save(path: string): Promise<void>;
  }

  export interface TTSInterface {
    language: string;
    languages: string[];
    load_default_speaker(name: string): unknown;
    generate(args: {
      text: string;
      speaker?: unknown;
      temperature?: number;
      repetition_penalty?: number;
      max_length?: number;
      additional_gen_config?: Record<string, unknown>;
    }): Promise<ModelOutput>;
  }

  export function InterfaceHF(inputs: {
    model_version: string;
    cfg: HFModelConfig_v1;
  }): Promise<TTSInterface>;
}
