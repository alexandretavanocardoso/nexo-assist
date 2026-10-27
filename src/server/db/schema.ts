import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { DecisionTrace } from "@/agent/trace";
import type { ConversationStatus } from "@/domain/conversation-state";
import type { Category, Impact, Priority, Role, SupportLevel, TicketStatus, TicketType, Urgency } from "@/domain/types";
import type { DraftPayload, Handoff, UiBlock } from "@/services/conversations/types";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").$type<Role>().notNull(),
  department: text("department").notNull(),
  /** Equipamento principal (ajuda o agent a aplicar artigos como o do erro 809). */
  device: text("device"),
  /** Nível de suporte, só para analistas. */
  supportLevel: text("support_level").$type<SupportLevel>(),
});

// --- Sistema de chamados (legado simulado) ---

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    type: text("type").$type<TicketType>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").$type<Category>().notNull(),
    priority: text("priority").$type<Priority>().notNull(),
    impact: text("impact").$type<Impact>().notNull(),
    urgency: text("urgency").$type<Urgency>().notNull(),
    status: text("status").$type<TicketStatus>().notNull(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => employees.id),
    assignedLevel: text("assigned_level").$type<SupportLevel>(),
    createdAt: timestamp("created_at").notNull(),
    /** Última ação do service desk: é daqui que o prazo (SLA) é contado. */
    lastServiceUpdateAt: timestamp("last_service_update_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [index("tickets_requester_idx").on(t.requesterId)],
);

export const ticketEvents = sqliteTable(
  "ticket_events",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    kind: text("kind").$type<"created" | "comment" | "status" | "reopened" | "transferred">().notNull(),
    author: text("author").$type<"employee" | "analyst" | "system">().notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketId)],
);

// --- Conversas (chat, rascunhos e transferências) ---

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    status: text("status").$type<ConversationStatus>().notNull(),
    assignedAnalystId: text("assigned_analyst_id").references(() => employees.id),
    /** Resumo do caso levado ao analista na transferência. */
    handoff: text("handoff", { mode: "json" }).$type<Handoff>(),
    /** Se o agent resolveu sem transferir (usado nas etiquetas do console). */
    closedReason: text("closed_reason").$type<"resolvida_pelo_agent" | "encerrada_pelo_analista" | "nova_conversa">(),
    userMessageCount: integer("user_message_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    lastMessageAt: timestamp("last_message_at").notNull(),
  },
  (t) => [index("conversations_employee_idx").on(t.employeeId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    role: text("role").$type<"user" | "assistant" | "analyst" | "system">().notNull(),
    authorId: text("author_id"),
    text: text("text").notNull(),
    blocks: text("blocks", { mode: "json" }).$type<UiBlock[]>().notNull(),
    /** Decision trace estruturado: o que o agent entendeu, fez, com que confiança e por quê. */
    trace: text("trace", { mode: "json" }).$type<DecisionTrace>(),
    confidence: real("confidence"),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  /** Código curto exibido no cartão, ex.: "D-381". */
  code: text("code").notNull(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  payload: text("payload", { mode: "json" }).$type<DraftPayload>().notNull(),
  status: text("status").$type<"pending" | "committed" | "cancelled" | "superseded">().notNull(),
  ticketNumber: text("ticket_number"),
  createdAt: timestamp("created_at").notNull(),
  decidedAt: timestamp("decided_at"),
});
