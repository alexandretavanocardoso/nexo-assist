import { getSlaStatus } from "@/domain/sla";
import type { Ticket, TicketEvent, TicketView } from "./types";

/** Converte o chamado do sistema legado na visão usada pela interface e pelo agent, com o prazo calculado. */
export function toTicketView(ticket: Ticket, now: Date, events: TicketEvent[] = []): TicketView {
  const sla = getSlaStatus(ticket, now);
  const lastEvent = events[events.length - 1];
  return {
    number: ticket.number,
    type: ticket.type,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    impact: ticket.impact,
    status: ticket.status,
    assignedLevel: ticket.assignedLevel,
    openedAt: ticket.createdAt.toISOString(),
    lastUpdateAt: ticket.lastServiceUpdateAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    dueAt: sla.dueAt?.toISOString() ?? null,
    overdue: sla.overdue,
    slaLabel: sla.slaLabel,
    lastEvent: lastEvent ? { text: lastEvent.text, at: lastEvent.createdAt.toISOString() } : null,
  };
}
