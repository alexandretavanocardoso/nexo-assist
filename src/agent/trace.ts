// Decision trace: registro estruturado de cada resposta do agent.
// É salvo junto com a mensagem e exibido na interface ("ver decisão").
import { z } from "zod";

export const INTENTS = [
  "duvida",
  "consulta",
  "complemento",
  "abertura",
  "reabertura",
  "transferencia",
  "fora_de_escopo",
  "saudacao",
  "outro",
  // Ações executadas pelo servidor depois de um clique (sem LLM):
  "confirmacao",
  "cancelamento",
] as const;
export type Intent = (typeof INTENTS)[number];
export const intentSchema = z.enum(INTENTS);

export const INTENT_LABELS: Record<Intent, string> = {
  duvida: "Dúvida",
  consulta: "Consulta de chamado",
  complemento: "Complemento de chamado",
  abertura: "Abertura de chamado",
  reabertura: "Reabertura de chamado",
  transferencia: "Falar com analista",
  fora_de_escopo: "Fora do escopo de TI",
  saudacao: "Saudação",
  outro: "Outro",
  confirmacao: "Confirmação do funcionário",
  cancelamento: "Cancelamento do funcionário",
};

export type TraceStep = {
  id: string;
  /** Nome técnico da ferramenta (ex.: listar_meus_chamados) ou da ação do servidor. */
  tool: string;
  /** Rótulo em linguagem natural exibido acima da resposta (ex.: "consultou seus chamados"). */
  labels: string[];
  input: unknown;
  output: unknown;
  status: "ok" | "error";
  /** Tentativas no sistema de chamados (>1 quando houve indisponibilidade). */
  attempts: number;
  durationMs: number;
  /** Regras do service desk aplicadas nesta etapa, em linguagem natural. */
  rules: string[];
};

export type TraceMetrics = {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  latencyMs: number;
  firstTokenMs: number | null;
};

export type DecisionTrace = {
  /** "agent" = decidido pelo LLM; "server" = ação determinística depois de um clique ou regra. */
  source: "agent" | "server";
  intent: Intent | null;
  /** O que o agent entendeu do pedido, em uma frase. */
  understood: string | null;
  /** A ação que o agent decidiu tomar. */
  action: string | null;
  /** Confiança de 0 a 1 declarada pelo agent (ou 1 para ações determinísticas). */
  confidence: number | null;
  /** Por que essa ação. */
  rationale: string | null;
  steps: TraceStep[];
  metrics: TraceMetrics;
};

export function emptyMetrics(): TraceMetrics {
  return {
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    costUsd: 0,
    latencyMs: 0,
    firstTokenMs: null,
  };
}

/** Todas as regras aplicadas na resposta, sem repetição. */
export function rulesOf(trace: DecisionTrace): string[] {
  return [...new Set(trace.steps.flatMap((step) => step.rules))];
}

/** Rótulos das ações, na ordem em que aconteceram, para a linha de status. */
export function actionLabelsOf(trace: DecisionTrace): string[] {
  return [...new Set(trace.steps.flatMap((step) => step.labels))];
}
