// Protocolo de streaming (SSE) entre o servidor e o chat. Compartilhado pelos dois lados.
import type { ChatMessage, ConversationView, UiBlock } from "@/services/conversations/types";

export type StepEvent = {
  id: string;
  labels: string[];
  status: "running" | "done" | "error";
};

export type StreamEvent =
  /** A mensagem do funcionário foi salva. */
  | { type: "user-message"; message: ChatMessage }
  /** Uma ação do agent começou ou terminou (vira a linha de status acima da resposta). */
  | { type: "step"; step: StepEvent }
  /** Aviso temporário, ex.: "sistema de chamados instável, tentando de novo". */
  | { type: "notice"; text: string }
  | { type: "text-delta"; text: string }
  | { type: "block"; block: UiBlock }
  /** Fim do turno: estado completo e salvo da conversa. */
  | { type: "done"; conversation: ConversationView }
  | { type: "error"; code: string; message: string; retryable: boolean };
