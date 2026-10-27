// Vocabulário do service desk (Anexo A do PRD). Tudo aqui é compartilhado entre
// serviço de chamados, agent e interface, por isso usa os mesmos termos do PRD.
import { z } from "zod";

export const TICKET_TYPES = ["INC", "REQ"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const CATEGORIES = ["Acesso", "Rede e VPN", "Hardware", "Software", "E-mail", "Outros"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["Crítica", "Alta", "Média", "Baixa"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Impacto: quantas pessoas são afetadas. */
export const IMPACTS = ["pessoa", "equipe", "empresa"] as const;
export type Impact = (typeof IMPACTS)[number];

/** Urgência: o quanto o problema impede o trabalho ou põe um compromisso em risco. */
export const URGENCIES = ["parado", "compromisso_hoje", "atrapalha", "sem_urgencia"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const TICKET_STATUSES = [
  "Aberto",
  "Em andamento",
  "Aguardando analista",
  "Aprovado",
  "Resolvido",
  "Fechado",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Status em que o chamado ainda está com a TI (contam prazo e podem ser atualizados). */
export const OPEN_STATUSES: readonly TicketStatus[] = ["Aberto", "Em andamento", "Aguardando analista", "Aprovado"];

export function isOpenStatus(status: TicketStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export const SUPPORT_LEVELS = ["N1", "N2"] as const;
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];

export const ROLES = ["employee", "analyst"] as const;
export type Role = (typeof ROLES)[number];

/** Quem está fazendo a operação. Vem sempre da sessão, nunca do LLM. */
export type Actor = { id: string; role: Role };

export const IMPACT_LABELS: Record<Impact, string> = {
  pessoa: "Somente você",
  equipe: "Sua equipe",
  empresa: "Toda a empresa",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  parado: "algo parou e impede o trabalho",
  compromisso_hoje: "há um compromisso hoje em risco",
  atrapalha: "atrapalha, mas há alternativa",
  sem_urgencia: "sem urgência",
};

export const ticketTypeSchema = z.enum(TICKET_TYPES);
export const categorySchema = z.enum(CATEGORIES);
export const prioritySchema = z.enum(PRIORITIES);
export const impactSchema = z.enum(IMPACTS);
export const urgencySchema = z.enum(URGENCIES);
