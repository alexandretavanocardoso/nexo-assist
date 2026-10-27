import type { Category, Impact, Priority, SupportLevel, TicketStatus, TicketType, Urgency } from "@/domain/types";
import type { ticketEvents, tickets } from "@/server/db/schema";

export type Ticket = typeof tickets.$inferSelect;
export type TicketEvent = typeof ticketEvents.$inferSelect;

export type NewTicketInput = {
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  impact: Impact;
  urgency: Urgency;
};

/** Visão serializável do chamado, com o prazo já calculado. É o que vai para a interface e para o agent. */
export type TicketView = {
  number: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  impact: Impact;
  status: TicketStatus;
  assignedLevel: SupportLevel | null;
  openedAt: string;
  lastUpdateAt: string;
  resolvedAt: string | null;
  dueAt: string | null;
  overdue: boolean;
  slaLabel: string;
  lastEvent: { text: string; at: string } | null;
};
