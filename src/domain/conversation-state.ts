// Máquina de estados da conversa. Garante em código que o agent só responde
// quando a conversa está com ele, e que só transições válidas acontecem.

export const CONVERSATION_STATUSES = ["agent", "waiting_human", "human", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export type ConversationEvent =
  | "transfer" // agent (ou regra automática) transfere para um analista
  | "assume" // analista assume o atendimento
  | "release" // analista devolve ao agent
  | "close"; // analista encerra (ou funcionário inicia uma nova conversa)

const TRANSITIONS: Record<ConversationStatus, Partial<Record<ConversationEvent, ConversationStatus>>> = {
  agent: { transfer: "waiting_human", close: "closed" },
  waiting_human: { assume: "human", release: "agent", close: "closed" },
  human: { release: "agent", close: "closed" },
  closed: {},
};

export class InvalidTransitionError extends Error {
  constructor(from: ConversationStatus, event: ConversationEvent) {
    super(`Transição inválida: "${event}" a partir de "${from}".`);
    this.name = "InvalidTransitionError";
  }
}

export function transition(from: ConversationStatus, event: ConversationEvent): ConversationStatus {
  const to = TRANSITIONS[from][event];
  if (!to) throw new InvalidTransitionError(from, event);
  return to;
}

/** O agent só pode responder enquanto a conversa está com ele. */
export function agentCanReply(status: ConversationStatus): boolean {
  return status === "agent";
}

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  agent: "Agent atendendo",
  waiting_human: "Aguardando atendente",
  human: "Analista atendendo",
  closed: "Encerrada",
};

/** Limite de mensagens do funcionário por sessão (conversa). */
export const MESSAGE_LIMIT = 30;

/** Confiança abaixo da qual a decisão do agent é considerada insegura. */
export const LOW_CONFIDENCE = 0.5;

/**
 * Regra de transferência por baixa segurança: se o agent registrou confiança baixa
 * em duas respostas seguidas, a conversa vai para um analista.
 */
export function shouldEscalateForLowConfidence(recentConfidences: Array<number | null>): boolean {
  const lastTwo = recentConfidences.slice(-2);
  return lastTwo.length === 2 && lastTwo.every((c) => c !== null && c < LOW_CONFIDENCE);
}
