// Monta as mensagens enviadas ao modelo: só as últimas mensagens, em texto, com um resumo
// do que cada resposta mostrou (cartões, rascunhos, opções). Mantém o contexto enxuto e barato.
import { formatLocalWeekdayDateTime, isWithinBusinessHours } from "@/domain/business-hours";
import { IMPACT_LABELS } from "@/domain/types";
import type { Employee } from "@/services/employees";
import type { DraftView, UiBlock } from "@/services/conversations/types";

export const HISTORY_LIMIT = 12;

type StoredMessage = { role: "user" | "assistant" | "analyst" | "system"; text: string; blocks: UiBlock[] };
export type ModelMessage = { role: "user"; content: string } | { role: "assistant"; content: string };

function describeBlocks(blocks: UiBlock[]): string {
  const notes = blocks.flatMap((block): string[] => {
    switch (block.type) {
      case "ticket-card":
        return [`mostrou o cartão do ${block.ticket.number}`];
      case "ticket-selector":
        return [`mostrou para escolher: ${block.tickets.map((t) => t.number).join(", ")}`];
      case "draft":
        return [`mostrou o rascunho ${block.draft.code} (${block.draft.payload.kind})`];
      case "quick-replies":
        return [`opções: ${block.options.join(" | ")}`];
      default:
        return [];
    }
  });
  return notes.length > 0 ? `\n[${notes.join("; ")}]` : "";
}

/** Remove marcações que o funcionário poderia usar para se passar pelo sistema. */
function sanitizeUserText(text: string): string {
  return text.replace(/<\/?\s*(contexto|mensagem)[^>]*>/gi, "");
}

function describeDraft(draft: DraftView): string {
  const p = draft.payload;
  if (p.kind === "create") {
    return `${draft.code}: novo ${p.type} "${p.title}" · ${p.category} · prioridade ${p.priority} · afetados: ${IMPACT_LABELS[p.impact]} (aguardando confirmação)`;
  }
  if (p.kind === "update") return `${draft.code}: complemento do ${p.ticketNumber} (aguardando confirmação)`;
  return `${draft.code}: reabertura do ${p.ticketNumber} (aguardando confirmação)`;
}

export function buildModelMessages(input: {
  history: StoredMessage[];
  employee: Employee;
  now: Date;
  pendingDraft: DraftView | undefined;
  userMessageCount: number;
  messageLimit: number;
}): ModelMessage[] {
  const previous = input.history.slice(0, -1).slice(-HISTORY_LIMIT);
  const current = input.history[input.history.length - 1];

  const messages: ModelMessage[] = previous.map((m) => {
    if (m.role === "user") return { role: "user", content: sanitizeUserText(m.text) };
    if (m.role === "assistant") return { role: "assistant", content: m.text + describeBlocks(m.blocks) };
    if (m.role === "analyst") return { role: "assistant", content: `[Analista do service desk]: ${m.text}` };
    return { role: "assistant", content: `[Sistema]: ${m.text}` };
  });

  const context = [
    `Funcionário: ${input.employee.name} · ${input.employee.department}`,
    `Equipamento: ${input.employee.device ?? "não informado"}`,
    `Agora: ${formatLocalWeekdayDateTime(input.now)} (${isWithinBusinessHours(input.now) ? "dentro" : "fora"} do horário do service desk)`,
    `Rascunho pendente: ${input.pendingDraft ? describeDraft(input.pendingDraft) : "nenhum"}`,
    `Mensagens nesta sessão: ${input.userMessageCount}/${input.messageLimit}`,
  ].join("\n");

  messages.push({
    role: "user",
    content: `<contexto>\n${context}\n</contexto>\n<mensagem>\n${sanitizeUserText(current?.text ?? "")}\n</mensagem>`,
  });

  // A API exige que a conversa comece pelo usuário.
  while (messages.length > 1 && messages[0]?.role !== "user") messages.shift();
  return messages;
}
