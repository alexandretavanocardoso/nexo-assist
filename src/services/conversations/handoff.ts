// Regras da transferência para analista.
import { calculateDueDate } from "@/domain/sla";
import type { Priority, SupportLevel } from "@/domain/types";
import type { Handoff, HandoffReason } from "./types";

/** Casos críticos e chamados vencidos vão direto para o N2; o resto começa no N1. */
export function levelFor(reason: HandoffReason): SupportLevel {
  return reason === "caso_critico" || reason === "chamado_vencido" ? "N2" : "N1";
}

export function buildHandoff(input: {
  reason: HandoffReason;
  summary: string;
  ticketNumber: string | null;
  /** Prioridade do chamado relacionado. Sem chamado, usamos Alta: há uma pessoa aguardando no chat. */
  ticketPriority: Priority | null;
  confidence: number | null;
  now: Date;
}): Handoff {
  const priority = input.ticketPriority ?? "Alta";
  return {
    reason: input.reason,
    summary: input.summary,
    ticketNumber: input.ticketNumber,
    level: levelFor(input.reason),
    priority,
    confidence: input.confidence,
    transferredAt: input.now.toISOString(),
    contactDueAt: calculateDueDate(priority, input.now).toISOString(),
  };
}
