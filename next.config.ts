import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 é um módulo nativo e o Mastra carrega dependências dinâmicas:
  // os dois rodam direto no Node, sem passar pelo bundler.
  serverExternalPackages: ["better-sqlite3", "@mastra/core"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
