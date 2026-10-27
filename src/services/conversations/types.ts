import type { DecisionTrace } from "@/agent/trace";
import type { ConversationStatus } from "@/domain/conversation-state";
import type { Category, Impact, Priority, SupportLevel, TicketType, Urgency } from "@/domain/types";
import type { TicketView } from "@/services/tickets/types";

// --- Rascunhos: tudo que cria ou altera um chamado passa por aqui antes da confirmação ---

export type CreateDraftPayload = {
  kind: "create";
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  impact: Impact;
  urgency: Urgency;
  priority: Priority;
  priorityReason: string;
  slaLabel: string;
  /** Prazo da primeira resposta se o chamado fosse criado agora (ISO). */
  dueAt: string;
};

export type UpdateDraftPayload = { kind: "update"; ticketNumber: string; ticketTitle: string; note: string };

export type ReopenDraftPayload = { kind: "reopen"; ticketNumber: string; ticketTitle: string; reason: string };

export type DraftPayload = CreateDraftPayload | UpdateDraftPayload | ReopenDraftPayload;

export type DraftStatus = "pending" | "committed" | "cancelled" | "superseded";

export type DraftView = {
  id: string;
  code: string;
  status: DraftStatus;
  payload: DraftPayload;
  ticketNumber: string | null;
};

// --- Transferência para analista ---

export const HANDOFF_REASONS = ["pedido_do_funcionario", "caso_critico", "chamado_vencido", "baixa_confianca"] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export const HANDOFF_REASON_LABELS: Record<HandoffReason, string> = {
  pedido_do_funcionario: "Pedido do funcionário",
  caso_critico: "Caso crítico",
  chamado_vencido: "Chamado vencido",
  baixa_confianca: "Agent sem segurança",
};

export type Handoff = {
  reason: HandoffReason;
  summary: string;
  ticketNumber: string | null;
  level: SupportLevel;
  priority: Priority;
  /** Confiança do agent no momento da transferência (útil quando o motivo é baixa segurança). */
  confidence: number | null;
  transferredAt: string;
  /** Até quando um analista deve falar com o funcionário (prazo da prioridade). */
  contactDueAt: string;
};

// --- Blocos de interface anexados às respostas ---

export type UiBlock =
  | { type: "ticket-card"; ticket: TicketView }
  | { type: "ticket-selector"; tickets: TicketView[] }
  | { type: "draft"; draft: DraftView }
  | { type: "quick-replies"; options: string[] }
  | { type: "articles"; articles: Array<{ id: string; title: string }> }
  | { type: "notice"; tone: "info" | "warning" | "error"; text: string };

// --- DTOs enviados para a interface ---

export type MessageRole = "user" | "assistant" | "analyst" | "system";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  blocks: UiBlock[];
  trace: DecisionTrace | null;
  author: { name: string; label: string | null } | null;
  createdAt: string;
};

export type ConversationView = {
  id: string;
  status: ConversationStatus;
  employee: { id: string; name: string; email: string; department: string };
  assignedAnalyst: { id: string; name: string; level: SupportLevel | null } | null;
  handoff: Handoff | null;
  userMessageCount: number;
  messageLimit: number;
  messages: ChatMessage[];
};
