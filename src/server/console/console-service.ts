// Console do analista: lista de conversas, assumir, devolver ao agent, encerrar e responder.
import { desc, eq, inArray } from "drizzle-orm";
import type { ConversationStatus } from "@/domain/conversation-state";
import type { Actor } from "@/domain/types";
import type { Db } from "@/server/db/client";
import { conversations, employees, messages } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { addMessage, applyEvent, getConversation } from "@/services/conversations/conversation-service";
import type { Handoff } from "@/services/conversations/types";
import type { Employee } from "@/services/employees";
import { withRetry } from "@/services/tickets/retry";
import type { TicketService } from "@/services/tickets/ticket-service";

export const CONSOLE_FILTERS = ["todas", "para_voce", "com_agent", "minhas"] as const;
export type ConsoleFilter = (typeof CONSOLE_FILTERS)[number];

export type ConsoleListItem = {
  id: string;
  status: ConversationStatus;
  employee: { id: string; name: string; department: string };
  lastMessage: { text: string; role: string; at: string } | null;
  unread: number;
  handoff: Handoff | null;
  assignedAnalyst: { id: string; name: string } | null;
  closedReason: string | null;
  online: boolean;
};

export type ConsoleList = { items: ConsoleListItem[]; counts: Record<ConsoleFilter, number> };

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const CLOSED_VISIBLE_MS = 3 * 24 * 60 * 60 * 1000;

export function listConsoleConversations(db: Db, analyst: Employee, filter: ConsoleFilter, query: string, now: Date): ConsoleList {
  const rows = db
    .select({ conversation: conversations, employee: employees })
    .from(conversations)
    .innerJoin(employees, eq(conversations.employeeId, employees.id))
    .orderBy(desc(conversations.lastMessageAt))
    .all()
    .filter(({ conversation }) => conversation.status !== "closed" || now.getTime() - conversation.lastMessageAt.getTime() < CLOSED_VISIBLE_MS);

  const ids = rows.map((r) => r.conversation.id);
  const allMessages = ids.length
    ? db.select().from(messages).where(inArray(messages.conversationId, ids)).orderBy(messages.createdAt).all()
    : [];
  const analystNames = new Map(db.select().from(employees).where(eq(employees.role, "analyst")).all().map((a) => [a.id, a.name]));

  const items: ConsoleListItem[] = rows.map(({ conversation, employee }) => {
    const history = allMessages.filter((m) => m.conversationId === conversation.id);
    const visible = history.filter((m) => m.role !== "system");
    const last = visible.at(-1);
    // Não lidas: mensagens do funcionário depois da última resposta de um analista (quando precisa de gente).
    const lastAnalyst = history.findLastIndex((m) => m.role === "analyst");
    const unread =
      conversation.status === "waiting_human" || conversation.status === "human"
        ? history.slice(lastAnalyst + 1).filter((m) => m.role === "user").length
        : 0;
    return {
      id: conversation.id,
      status: conversation.status,
      employee: { id: employee.id, name: employee.name, department: employee.department },
      lastMessage: last ? { text: last.text, role: last.role, at: last.createdAt.toISOString() } : null,
      unread,
      handoff: conversation.handoff,
      assignedAnalyst: conversation.assignedAnalystId
        ? { id: conversation.assignedAnalystId, name: analystNames.get(conversation.assignedAnalystId) ?? "Analista" }
        : null,
      closedReason: conversation.closedReason,
      online: now.getTime() - conversation.lastMessageAt.getTime() < ONLINE_WINDOW_MS,
    };
  });

  const matches: Record<ConsoleFilter, (item: ConsoleListItem) => boolean> = {
    todas: () => true,
    para_voce: (item) => item.status === "waiting_human",
    com_agent: (item) => item.status === "agent",
    minhas: (item) => item.status === "human" && item.assignedAnalyst?.id === analyst.id,
  };
  const normalizedQuery = query.trim().toLowerCase();
  const searched = normalizedQuery
    ? items.filter(
        (item) =>
          item.employee.name.toLowerCase().includes(normalizedQuery) ||
          (item.handoff?.ticketNumber ?? "").toLowerCase().includes(normalizedQuery) ||
          (item.lastMessage?.text ?? "").toLowerCase().includes(normalizedQuery),
      )
    : items;

  return {
    items: searched.filter(matches[filter]),
    counts: {
      todas: items.length,
      para_voce: items.filter(matches.para_voce).length,
      com_agent: items.filter(matches.com_agent).length,
      minhas: items.filter(matches.minhas).length,
    },
  };
}

export class ConsoleActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsoleActionError";
  }
}

const analystLabel = (analyst: Employee) => `${analyst.name}${analyst.supportLevel ? ` (Suporte ${analyst.supportLevel})` : ""}`;

/** Analista assume: o agent fica pausado e o chamado relacionado passa a "Em andamento". */
export async function assumeConversation(db: Db, tickets: TicketService, analyst: Employee, conversationId: string, now: Date) {
  const conversation = applyEvent(db, conversationId, "assume", now, { assignedAnalystId: analyst.id });
  addMessage(db, { conversationId, role: "system", text: `${analyst.name} assumiu · agent pausado` }, now);

  const ticketNumber = conversation.handoff?.ticketNumber;
  if (ticketNumber) {
    const actor: Actor = { id: analyst.id, role: "analyst" };
    const result = await withRetry(() => tickets.markInService(actor, ticketNumber, analyst.name));
    if (!result.ok) logger.warn("console.mark_in_service_failed", { conversationId, ticketNumber, error: result.error });
  }
}

export function releaseConversation(db: Db, analyst: Employee, conversationId: string, now: Date) {
  applyEvent(db, conversationId, "release", now, { assignedAnalystId: null });
  addMessage(db, { conversationId, role: "system", text: `${analyst.name} devolveu a conversa ao agent` }, now);
}

export function closeConversation(db: Db, analyst: Employee, conversationId: string, now: Date) {
  applyEvent(db, conversationId, "close", now, { closedReason: "encerrada_pelo_analista" });
  addMessage(db, { conversationId, role: "system", text: `Atendimento encerrado por ${analystLabel(analyst)}` }, now);
}

export function sendAnalystMessage(db: Db, analyst: Employee, conversationId: string, text: string, now: Date) {
  const conversation = getConversation(db, conversationId);
  if (conversation.status !== "human" || conversation.assignedAnalystId !== analyst.id) {
    throw new ConsoleActionError("Assuma o atendimento para responder.");
  }
  addMessage(db, { conversationId, role: "analyst", authorId: analyst.id, text }, now);
}

