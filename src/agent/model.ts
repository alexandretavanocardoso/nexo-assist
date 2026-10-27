// Escolha do modelo. Padrão: Claude Haiku 5.5, o modelo pequeno e rápido da Anthropic.
// O agent só classifica, consulta e conversa (as regras pesadas estão em código), então um
// modelo pequeno basta, com latência e custo por conversa baixos. Trocável por variável de ambiente.
import type { MastraModelConfig } from "@mastra/core/llm";

export const MODEL_ID = process.env.NEXO_MODEL || "claude-haiku-5-5";

export type Effort = "low" | "medium" | "high";
export const EFFORT: Effort = (["low", "medium", "high"] as const).find((e) => e === process.env.NEXO_EFFORT) ?? "low";

/** Preço por milhão de tokens (US$), para estimar o custo de cada resposta. */
const PRICING: Record<string, { input: number; output: number; cachedInput: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cachedInput: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cachedInput: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cachedInput: 0.2 },
};

export function estimateCostUsd(
  modelId: string,
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number },
): number {
  const price = PRICING[modelId];
  if (!price) return 0;
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (uncached * price.input + usage.cachedInputTokens * price.cachedInput + usage.outputTokens * price.output) /
    1_000_000
  );
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY não configurada. Copie .env.example para .env e preencha a chave.");
    this.name = "MissingApiKeyError";
  }
}

/** Modelo pelo "model router" do Mastra (provedor/modelo + chave). */
export function createDefaultModel(): MastraModelConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  const id: `anthropic/${string}` = `anthropic/${MODEL_ID}`;
  return { id, apiKey };
}
