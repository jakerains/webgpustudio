import type { NextConfig } from "next";
import path from "path";

const emptyModule = path.resolve(__dirname, "src/lib/empty.ts");

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      sharp$: emptyModule,
      "onnxruntime-node$": emptyModule,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    };
    return config;
  },
};

export default nextConfig;
