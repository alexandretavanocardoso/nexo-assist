// Formata dados para o modelo: só o necessário (contexto enxuto) e já em linguagem natural.
import { formatAgo, formatDue, formatLocalDate, formatLocalDateTime } from "@/domain/business-hours";
import { TicketNotFoundError, TicketRuleError, TicketServiceUnavailableError } from "@/services/tickets/errors";
import type { TicketView } from "@/services/tickets/types";

export function ticketForModel(view: TicketView, now: Date) {
  return {
    numero: view.number,
    tipo: view.type,
    titulo: view.title,
    status: view.status,
    prioridade: view.priority,
    categoria: view.category,
    aberto_em: formatLocalDateTime(new Date(view.openedAt)),
    ultima_atualizacao_do_service_desk: formatAgo(new Date(view.lastUpdateAt), now),
    prazo_da_prioridade: view.slaLabel,
    proxima_resposta_ate: view.dueAt ? formatDue(new Date(view.dueAt), now) : null,
    vencido: view.overdue,
    resolvido_em: view.resolvedAt ? formatLocalDate(new Date(view.resolvedAt)) : null,
  };
}

/** Converte falhas do sistema de chamados em uma saída que o modelo sabe explicar. */
export function ticketErrorOutput(error: unknown, attempts: number) {
  if (error instanceof TicketServiceUnavailableError) {
    return {
      status: "error" as const,
      output: {
        ok: false,
        erro: "sistema_indisponivel",
        mensagem: `O sistema de chamados está fora do ar no momento (${attempts} tentativas). Peça para o funcionário tentar de novo em alguns instantes.`,
      },
    };
  }
  if (error instanceof TicketNotFoundError) {
    return {
      status: "ok" as const,
      output: {
        ok: false,
        erro: "nao_encontrado",
        mensagem: "Não existe chamado com esse número entre os chamados deste funcionário.",
      },
      rules: ["Privacidade: informações de um chamado só vão para quem o abriu"],
    };
  }
  if (error instanceof TicketRuleError) {
    return { status: "ok" as const, output: { ok: false, erro: "regra_do_service_desk", mensagem: error.message } };
  }
  throw error;
}
