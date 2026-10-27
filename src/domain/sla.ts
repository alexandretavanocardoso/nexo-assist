// Prazos do Anexo A. O prazo vale para a primeira resposta e para cada atualização:
// conta a partir da última ação do service desk (ou da abertura) e, passado o prazo,
// o chamado está vencido.
import { addBusinessMinutes, BUSINESS_DAY_MINUTES } from "./business-hours";
import { isOpenStatus, type Priority, type TicketStatus } from "./types";

type SlaRule = { label: string; minutes: number; businessHours: boolean };

export const SLA_RULES: Record<Priority, SlaRule> = {
  // Críticos têm plantão 24 horas, então o prazo é em horas corridas.
  Crítica: { label: "1 hora", minutes: 60, businessHours: false },
  Alta: { label: "4 horas úteis", minutes: 4 * 60, businessHours: true },
  // 1 dia útil = 1 jornada de 10 h (8h às 18h).
  Média: { label: "3 dias úteis", minutes: 3 * BUSINESS_DAY_MINUTES, businessHours: true },
  Baixa: { label: "5 dias úteis", minutes: 5 * BUSINESS_DAY_MINUTES, businessHours: true },
};

export function calculateDueDate(priority: Priority, since: Date): Date {
  const rule = SLA_RULES[priority];
  return rule.businessHours
    ? addBusinessMinutes(since, rule.minutes)
    : new Date(since.getTime() + rule.minutes * 60 * 1000);
}

export type SlaStatus = {
  dueAt: Date | null;
  overdue: boolean;
  slaLabel: string;
};

/** Situação do prazo de um chamado. Chamados resolvidos ou fechados não têm prazo. */
export function getSlaStatus(
  ticket: { priority: Priority; status: TicketStatus; lastServiceUpdateAt: Date },
  now: Date,
): SlaStatus {
  const slaLabel = SLA_RULES[ticket.priority].label;
  if (!isOpenStatus(ticket.status)) return { dueAt: null, overdue: false, slaLabel };
  const dueAt = calculateDueDate(ticket.priority, ticket.lastServiceUpdateAt);
  return { dueAt, overdue: now.getTime() > dueAt.getTime(), slaLabel };
}
