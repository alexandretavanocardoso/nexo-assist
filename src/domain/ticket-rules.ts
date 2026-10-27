// Regras de abertura, duplicidade e reabertura (Anexo A do PRD).
import { similarityScore } from "./similarity";
import { isOpenStatus, type Category, type TicketStatus } from "./types";

export const REOPEN_WINDOW_DAYS = 7;

/** Pontuação a partir da qual consideramos que é o mesmo problema (mesma categoria). */
export const DUPLICATE_THRESHOLD = 0.5;
/** Pontuação a partir da qual o agent precisa perguntar se é o mesmo problema. */
export const POSSIBLE_DUPLICATE_THRESHOLD = 0.3;

type ComparableTicket = {
  number: string;
  title: string;
  description: string;
  category: Category;
  status: TicketStatus;
  resolvedAt: Date | null;
};

export type SimilarTicket = { number: string; title: string; score: number };

export type DuplicateCheck = {
  /** Chamado aberto sobre o mesmo problema: deve ser atualizado, não duplicado. */
  duplicate: SimilarTicket | null;
  /** Chamados abertos parecidos: o agent pergunta antes de abrir outro. */
  possibleDuplicates: SimilarTicket[];
  /** Chamado resolvido há até 7 dias sobre o mesmo problema: pode ser reaberto. */
  reopenCandidate: SimilarTicket | null;
};

function score(candidate: { title: string; description: string }, ticket: ComparableTicket): number {
  const titleScore = similarityScore(candidate.title, ticket.title);
  const fullScore = similarityScore(
    `${candidate.title} ${candidate.description}`,
    `${ticket.title} ${ticket.description}`,
  );
  return Math.round(Math.max(titleScore, fullScore) * 100) / 100;
}

export function checkDuplicates(
  candidate: { title: string; description: string; category: Category },
  tickets: ComparableTicket[],
  now: Date,
): DuplicateCheck {
  const scored = tickets
    .map((ticket) => ({ ticket, score: score(candidate, ticket) }))
    .sort((a, b) => b.score - a.score);

  const open = scored.filter(({ ticket }) => isOpenStatus(ticket.status));
  const toSimilar = ({ ticket, score: s }: { ticket: ComparableTicket; score: number }): SimilarTicket => ({
    number: ticket.number,
    title: ticket.title,
    score: s,
  });

  const duplicate = open.find(
    ({ ticket, score: s }) => ticket.category === candidate.category && s >= DUPLICATE_THRESHOLD,
  );
  const possibleDuplicates = open
    .filter((entry) => entry !== duplicate && entry.score >= POSSIBLE_DUPLICATE_THRESHOLD)
    .map(toSimilar);
  const reopenCandidate = scored.find(
    ({ ticket, score: s }) =>
      canReopen(ticket, now).allowed && ticket.category === candidate.category && s >= DUPLICATE_THRESHOLD,
  );

  return {
    duplicate: duplicate ? toSimilar(duplicate) : null,
    possibleDuplicates,
    reopenCandidate: reopenCandidate ? toSimilar(reopenCandidate) : null,
  };
}

export type RuleCheck = { allowed: true } | { allowed: false; reason: string };

export function canReopen(ticket: { status: TicketStatus; resolvedAt: Date | null }, now: Date): RuleCheck {
  if (ticket.status !== "Resolvido" || !ticket.resolvedAt) {
    return { allowed: false, reason: "Só chamados resolvidos podem ser reabertos." };
  }
  const days = (now.getTime() - ticket.resolvedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (days > REOPEN_WINDOW_DAYS) {
    return {
      allowed: false,
      reason: `O chamado foi resolvido há mais de ${REOPEN_WINDOW_DAYS} dias; é preciso abrir um novo chamado.`,
    };
  }
  return { allowed: true };
}

export function canUpdate(ticket: { status: TicketStatus }): RuleCheck {
  if (!isOpenStatus(ticket.status)) {
    return { allowed: false, reason: "O chamado não está aberto; só é possível reabrir (se resolvido há até 7 dias)." };
  }
  return { allowed: true };
}
