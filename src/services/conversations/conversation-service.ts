// Persistência das conversas: mensagens, rascunhos, estado (agent/analista) e transferência.
import { randomInt, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import type { DecisionTrace } from "@/agent/trace";
import { MESSAGE_LIMIT, transition, type ConversationEvent } from "@/domain/conversation-state";
import type { Db } from "@/server/db/client";
import { conversations, drafts, employees, messages } from "@/server/db/schema";
import type {
  ChatMessage,
  ConversationView,
  DraftPayload,
  DraftStatus,
  DraftView,
  Handoff,
  MessageRole,
  UiBlock,
} from "./types";

export type Conversation = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type DraftRow = typeof drafts.$inferSelect;

export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversa não encontrada.");
    this.name = "ConversationNotFoundError";
  }
}

// --- Conversas ---

export function getConversation(db: Db, id: string): Conversation {
  const conversation = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!conversation) throw new ConversationNotFoundError();
  return conversation;
}

/** A conversa em andamento do funcionário (a mais recente que não foi encerrada). */
export function findActiveConversation(db: Db, employeeId: string): Conversation | undefined {
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.employeeId, employeeId), ne(conversations.status, "closed")))
    .orderBy(desc(conversations.lastMessageAt))
    .get();
}

/** Retoma a conversa em andamento (mesmo em outro dia) ou começa uma nova. */
export function getOrCreateActiveConversation(db: Db, employeeId: string, now: Date): Conversation {
  const active = findActiveConversation(db, employeeId);
  if (active) return active;
  const conversation: Conversation = {
    id: randomUUID(),
    employeeId,
    status: "agent",
    assignedAnalystId: null,
    handoff: null,
    closedReason: null,
    userMessageCount: 0,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };
  db.insert(conversations).values(conversation).run();
  return conversation;
}

/** Encerra a conversa atual a pedido do funcionário e começa outra (ex.: depois do limite de mensagens). */
export function startNewConversation(db: Db, employeeId: string, now: Date): Conversation {
  const active = findActiveConversation(db, employeeId);
  if (active) {
    applyEvent(db, active.id, "close", now, {
      closedReason: active.handoff ? "nova_conversa" : "resolvida_pelo_agent",
    });
  }
  return getOrCreateActiveConversation(db, employeeId, now);
}

/** Aplica uma transição da máquina de estados (lança erro se for inválida). */
export function applyEvent(
  db: Db,
  conversationId: string,
  event: ConversationEvent,
  now: Date,
  changes: Partial<Pick<Conversation, "assignedAnalystId" | "handoff" | "closedReason">> = {},
): Conversation {
  const current = getConversation(db, conversationId);
  const status = transition(current.status, event);
  const updated = { ...current, ...changes, status, updatedAt: now };
  db.update(conversations)
    .set({ ...changes, status, updatedAt: now })
    .where(eq(conversations.id, conversationId))
    .run();
  return updated;
}

export function setHandoff(db: Db, conversationId: string, handoff: Handoff, now: Date): Conversation {
  return applyEvent(db, conversationId, "transfer", now, { handoff, assignedAnalystId: null });
}

// --- Mensagens ---

export function addMessage(
  db: Db,
  input: {
    conversationId: string;
    role: MessageRole;
    authorId?: string | null;
    text: string;
    blocks?: UiBlock[];
    trace?: DecisionTrace | null;
  },
  now: Date,
): MessageRow {
  const row: MessageRow = {
    id: randomUUID(),
    conversationId: input.conversationId,
    role: input.role,
    authorId: input.authorId ?? null,
    text: input.text,
    blocks: input.blocks ?? [],
    trace: input.trace ?? null,
    confidence: input.trace?.confidence ?? null,
    createdAt: now,
  };
  db.transaction((tx) => {
    tx.insert(messages).values(row).run();
    const conversation = tx.select().from(conversations).where(eq(conversations.id, input.conversationId)).get();
    if (!conversation) throw new ConversationNotFoundError();
    tx.update(conversations)
      .set({
        lastMessageAt: now,
        updatedAt: now,
        userMessageCount: conversation.userMessageCount + (input.role === "user" ? 1 : 0),
      })
      .where(eq(conversations.id, input.conversationId))
      .run();
  });
  return row;
}

export function listMessages(db: Db, conversationId: string): MessageRow[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all();
}

export function hasReachedMessageLimit(conversation: Conversation): boolean {
  return conversation.userMessageCount >= MESSAGE_LIMIT;
}

// --- Rascunhos ---

/** Cria um rascunho pendente. Rascunhos pendentes anteriores da conversa ficam "substituídos". */
export function createDraft(
  db: Db,
  input: { conversationId: string; employeeId: string; payload: DraftPayload },
  now: Date,
): DraftView {
  const row: DraftRow = {
    id: randomUUID(),
    code: `D-${randomInt(100, 1000)}`,
    conversationId: input.conversationId,
    employeeId: input.employeeId,
    payload: input.payload,
    status: "pending",
    ticketNumber: null,
    createdAt: now,
    decidedAt: null,
  };
  db.transaction((tx) => {
    tx.update(drafts)
      .set({ status: "superseded", decidedAt: now })
      .where(and(eq(drafts.conversationId, input.conversationId), eq(drafts.status, "pending")))
      .run();
    tx.insert(drafts).values(row).run();
  });
  return toDraftView(row);
}

export function findPendingDraft(db: Db, conversationId: string): DraftView | undefined {
  const row = db
    .select()
    .from(drafts)
    .where(and(eq(drafts.conversationId, conversationId), eq(drafts.status, "pending")))
    .orderBy(desc(drafts.createdAt))
    .get();
  return row ? toDraftView(row) : undefined;
}

/** Busca um rascunho garantindo que é do funcionário e da conversa informados. */
export function findOwnedDraft(
  db: Db,
  draftId: string,
  employeeId: string,
  conversationId: string,
): DraftView | undefined {
  const row = db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.employeeId, employeeId), eq(drafts.conversationId, conversationId)))
    .get();
  return row ? toDraftView(row) : undefined;
}

export function setDraftStatus(
  db: Db,
  draftId: string,
  status: Exclude<DraftStatus, "pending">,
  now: Date,
  ticketNumber: string | null = null,
): void {
  db.update(drafts).set({ status, decidedAt: now, ticketNumber }).where(eq(drafts.id, draftId)).run();
}

function toDraftView(row: DraftRow): DraftView {
  return { id: row.id, code: row.code, status: row.status, payload: row.payload, ticketNumber: row.ticketNumber };
}

// --- Visões para a interface ---

export function toConversationView(db: Db, conversation: Conversation): ConversationView {
  const rows = listMessages(db, conversation.id);
  const people = new Map(
    db
      .select()
      .from(employees)
      .where(
        inArray(employees.id, [
          conversation.employeeId,
          ...(conversation.assignedAnalystId ? [conversation.assignedAnalystId] : []),
          ...rows.flatMap((m) => (m.authorId ? [m.authorId] : [])),
        ]),
      )
      .all()
      .map((e) => [e.id, e]),
  );
  const draftStatus = new Map(
    db
      .select()
      .from(drafts)
      .where(eq(drafts.conversationId, conversation.id))
      .all()
      .map((d) => [d.id, toDraftView(d)]),
  );
  const employee = people.get(conversation.employeeId);
  if (!employee) throw new ConversationNotFoundError();
  const analyst = conversation.assignedAnalystId ? people.get(conversation.assignedAnalystId) : undefined;

  const toChatMessage = (m: MessageRow): ChatMessage => {
    const author = m.authorId ? people.get(m.authorId) : undefined;
    return {
      id: m.id,
      role: m.role,
      text: m.text,
      // O cartão do rascunho sempre mostra o estado atual (pendente, criado, cancelado...).
      blocks: m.blocks.map((block) =>
        block.type === "draft" ? { ...block, draft: draftStatus.get(block.draft.id) ?? block.draft } : block,
      ),
      trace: m.trace,
      author:
        m.role === "assistant"
          ? { name: "Nexo Assist", label: "IA" }
          : m.role === "analyst" && author
            ? { name: author.name, label: author.supportLevel ? `Suporte ${author.supportLevel}` : "Analista" }
            : m.role === "user" && author
              ? { name: author.name, label: null }
              : null,
      createdAt: m.createdAt.toISOString(),
    };
  };

  return {
    id: conversation.id,
    status: conversation.status,
    employee: { id: employee.id, name: employee.name, email: employee.email, department: employee.department },
    assignedAnalyst: analyst ? { id: analyst.id, name: analyst.name, level: analyst.supportLevel } : null,
    handoff: conversation.handoff,
    userMessageCount: conversation.userMessageCount,
    messageLimit: MESSAGE_LIMIT,
    messages: rows.map(toChatMessage),
  };
}
