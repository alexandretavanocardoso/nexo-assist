// Ações determinísticas sobre rascunhos, executadas pelo servidor (sem LLM) depois que o
// funcionário confirma ou cancela. É aqui que chamados são de fato criados, atualizados ou reabertos.
import { formatDue } from "@/domain/business-hours";
import { SLA_RULES } from "@/domain/sla";
import { emptyMetrics, type DecisionTrace } from "@/agent/trace";
import { callTickets, TurnRecorder, type TurnContext } from "@/agent/turn";
import { addMessage, setDraftStatus } from "@/services/conversations/conversation-service";
import { buildHandoff } from "@/services/conversations/handoff";
import type { DraftView, UiBlock } from "@/services/conversations/types";
import { TicketRuleError, TicketServiceUnavailableError } from "@/services/tickets/errors";
import type { Ticket } from "@/services/tickets/types";
import { toTicketView } from "@/services/tickets/view";
import { transferConversation } from "./transfer";

const CONFIRMATION_RATIONALE =
  "Criar, atualizar ou reabrir chamados só acontece depois da confirmação explícita do funcionário. " +
  "Essa etapa é executada pelo servidor, sem passar pelo modelo.";

const CONFIRMATION_RULE = "Só cria ou altera chamados depois da confirmação explícita do funcionário";

const ACTION_LABELS = { create: "criou o chamado", update: "atualizou o chamado", reopen: "reabriu o chamado" } as const;

const ACTION_DESCRIPTIONS = {
  create: (number: string) => `Criar o chamado ${number} no sistema de chamados`,
  update: (number: string) => `Acrescentar a nova informação ao ${number}`,
  reopen: (number: string) => `Reabrir o ${number}`,
} as const;

function serverTrace(recorder: TurnRecorder, fields: Pick<DecisionTrace, "intent" | "understood" | "action" | "rationale">): DecisionTrace {
  return { source: "server", confidence: 1, steps: recorder.steps, metrics: emptyMetrics(), ...fields };
}

export async function commitDraft(turn: TurnContext, draft: DraftView): Promise<void> {
  const { recorder, actor, tickets, now } = turn;
  const payload = draft.payload;
  const step = recorder.startStep(`servidor:${payload.kind}`, [ACTION_LABELS[payload.kind]], payload);

  const result = await callTickets(turn, (): Promise<Ticket> => {
    if (payload.kind === "create") {
      return tickets.create(actor, {
        type: payload.type,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        impact: payload.impact,
        urgency: payload.urgency,
      });
    }
    if (payload.kind === "update") return tickets.addComment(actor, payload.ticketNumber, payload.note);
    return tickets.reopen(actor, payload.ticketNumber, payload.reason);
  });

  if (!result.ok) {
    const unavailable = result.error instanceof TicketServiceUnavailableError;
    const reason =
      result.error instanceof TicketRuleError ? result.error.message : unavailable ? "sistema de chamados fora do ar" : "erro inesperado";
    step.finish({ output: { ok: false, erro: reason }, status: "error", attempts: result.attempts, rules: [] });
    if (!unavailable && !(result.error instanceof TicketRuleError)) throw result.error;
    const text = unavailable
      ? `O sistema de chamados está fora do ar e não consegui concluir depois de ${result.attempts} tentativas. ` +
        `O rascunho ${draft.code} continua salvo: é só confirmar de novo em alguns instantes.`
      : `Não consegui concluir: ${reason}`;
    addMessage(
      turn.db,
      {
        conversationId: turn.conversationId,
        role: "assistant",
        text,
        blocks: [{ type: "notice", tone: unavailable ? "warning" : "error", text: unavailable ? "Sistema de chamados indisponível" : reason }],
        trace: serverTrace(recorder, {
          intent: "confirmacao",
          understood: `Você confirmou o rascunho ${draft.code}.`,
          action: "Tentar executar o rascunho no sistema de chamados",
          rationale: unavailable ? "O sistema legado ficou indisponível mesmo depois das novas tentativas." : reason,
        }),
      },
      now,
    );
    return;
  }

  const ticket = result.value;
  setDraftStatus(turn.db, draft.id, "committed", now, ticket.number);
  const view = toTicketView(ticket, now);
  const due = view.dueAt ? formatDue(new Date(view.dueAt), now) : null;
  const rules = [CONFIRMATION_RULE];

  let text: string;
  if (payload.kind === "create") {
    text = `Pronto: abri o chamado ${ticket.number} com prioridade ${ticket.priority.toLowerCase()}. ` +
      `Um analista responde até ${due} (prazo de ${SLA_RULES[ticket.priority].label}).`;
  } else if (payload.kind === "update") {
    text = `Pronto: acrescentei a informação ao ${ticket.number}. Ela já aparece no histórico do chamado para o analista.`;
  } else {
    text = `Pronto: reabri o ${ticket.number}. Ele voltou para a fila e a próxima resposta chega até ${due}.`;
    rules.push("Chamados resolvidos há até 7 dias podem ser reabertos");
  }
  step.finish({ output: { ok: true, chamado: ticket.number, prioridade: ticket.priority }, status: "ok", attempts: result.attempts, rules });

  const blocks: UiBlock[] = [{ type: "ticket-card", ticket: view }];

  // Regra do Anexo A: caso crítico vai direto para um analista.
  if (payload.kind === "create" && ticket.priority === "Crítica") {
    const handoff = buildHandoff({
      reason: "caso_critico",
      summary: `Chamado crítico ${ticket.number}: ${ticket.title}. ${ticket.description}`,
      ticketNumber: ticket.number,
      ticketPriority: ticket.priority,
      confidence: 1,
      now,
    });
    const transferStep = recorder.startStep("servidor:transferir", ["transferiu para um analista"], { motivo: "caso_critico" });
    const transfer = await callTickets(turn, () =>
      tickets.transfer(actor, ticket.number, { level: handoff.level, summary: handoff.summary }),
    );
    transferStep.finish({
      output: { ok: transfer.ok },
      status: transfer.ok ? "ok" : "error",
      attempts: transfer.attempts,
      rules: ["Transferência: casos críticos vão para um analista (Suporte N2)"],
    });
    text += ` Como é um caso crítico, já chamei um analista do Suporte ${handoff.level}: ele fala com você por aqui até ${formatDue(new Date(handoff.contactDueAt), now)}.`;
    recorder.handoff = handoff;
  }

  addMessage(
    turn.db,
    {
      conversationId: turn.conversationId,
      role: "assistant",
      text,
      blocks,
      trace: serverTrace(recorder, {
        intent: "confirmacao",
        understood: `Você confirmou o rascunho ${draft.code}.`,
        action: ACTION_DESCRIPTIONS[payload.kind](ticket.number),
        rationale: CONFIRMATION_RATIONALE,
      }),
    },
    now,
  );
  if (recorder.handoff) transferConversation(turn.db, turn.conversationId, recorder.handoff, now);
}

export function cancelDraft(turn: TurnContext, draft: DraftView): void {
  setDraftStatus(turn.db, draft.id, "cancelled", turn.now);
  const step = turn.recorder.startStep("servidor:cancelar", ["descartou o rascunho"], { rascunho: draft.code });
  step.finish({ output: { ok: true }, status: "ok", attempts: 1, rules: ["Nada é criado ou alterado sem confirmação"] });
  addMessage(
    turn.db,
    {
      conversationId: turn.conversationId,
      role: "assistant",
      text: `Tudo bem, descartei o rascunho ${draft.code}. Posso ajudar com mais alguma coisa?`,
      trace: serverTrace(turn.recorder, {
        intent: "cancelamento",
        understood: `Você cancelou o rascunho ${draft.code}.`,
        action: "Descartar o rascunho sem alterar nenhum chamado",
        rationale: "O funcionário não confirmou; rascunhos cancelados não geram chamado.",
      }),
    },
    turn.now,
  );
}
