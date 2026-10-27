import { z } from "zod";
import { similarityScore } from "@/domain/similarity";
import { toTicketView } from "@/services/tickets/view";
import { defineNexoTool } from "../define-tool";
import { callTickets } from "../turn";
import { ticketErrorOutput, ticketForModel } from "./format";

export const ticketNumberSchema = z
  .string()
  .trim()
  .regex(/^(INC|REQ)-\d{4,6}$/i, "Use o formato INC-20311 ou REQ-10442.")
  .transform((value) => value.toUpperCase());

export const listarMeusChamados = defineNexoTool({
  id: "listar_meus_chamados",
  description:
    "Lista os chamados do funcionário logado (só os dele). Use para consultas sem número (passe uma descrição em " +
    "'busca'), para checar duplicidade antes de abrir chamado e para achar chamado a complementar ou reabrir. " +
    "Use mostrar_selecao=true quando houver vários e o funcionário precisar escolher.",
  inputSchema: z.object({
    situacao: z.enum(["abertos", "todos"]).default("abertos").describe("'todos' inclui os resolvidos (para reabertura)."),
    busca: z.string().max(200).optional().describe("Descrição do problema para ordenar por semelhança."),
    mostrar_selecao: z.boolean().default(false).describe("Mostra a lista para o funcionário escolher um chamado."),
  }),
  labels: () => ["consultou seus chamados"],
  run: async ({ situacao, busca, mostrar_selecao }, turn) => {
    const result = await callTickets(turn, () => turn.tickets.listMine(turn.actor, situacao === "abertos" ? "open" : "all"));
    if (!result.ok) return { ...ticketErrorOutput(result.error, result.attempts), attempts: result.attempts };

    let views = result.value.map((ticket) => toTicketView(ticket, turn.now));
    let note: string | undefined;
    if (busca) {
      const ranked = views
        .map((view) => ({ view, score: similarityScore(busca, `${view.title} ${view.description}`) }))
        .sort((a, b) => b.score - a.score);
      const similar = ranked.filter((r) => r.score >= 0.2).map((r) => r.view);
      if (similar.length > 0) views = similar;
      else note = "Nenhum chamado parecido com a busca; a lista traz todos os chamados da situação pedida.";
    }

    if (mostrar_selecao && views.length > 1) turn.recorder.addBlock({ type: "ticket-selector", tickets: views });

    return {
      output: { total: views.length, chamados: views.map((v) => ticketForModel(v, turn.now)), ...(note ? { observacao: note } : {}) },
      attempts: result.attempts,
      rules: ["Privacidade: só aparecem os chamados abertos por você"],
    };
  },
});

export const consultarChamado = defineNexoTool({
  id: "consultar_chamado",
  description:
    "Consulta um chamado do funcionário pelo número e mostra o cartão do chamado com status e prazo " +
    "(o prazo e o 'vencido' já vêm calculados pelas regras do service desk).",
  inputSchema: z.object({ numero: ticketNumberSchema }),
  labels: ({ numero }) => [`consultou o ${numero}`, "calculou o prazo"],
  run: async ({ numero }, turn) => {
    const result = await callTickets(turn, () => turn.tickets.getMine(turn.actor, numero));
    if (!result.ok) {
      return { ...ticketErrorOutput(result.error, result.attempts), attempts: result.attempts, labels: [`procurou o ${numero}`] };
    }
    const { ticket, events } = result.value;
    const view = toTicketView(ticket, turn.now, events);
    turn.recorder.addBlock({ type: "ticket-card", ticket: view });
    return {
      output: {
        chamado: { ...ticketForModel(view, turn.now), descricao: view.description },
        historico: events.slice(-3).map((e) => e.text),
      },
      attempts: result.attempts,
      rules: [
        `Prazo da prioridade ${view.priority}: ${view.slaLabel}, contado da última ação do service desk`,
        view.overdue ? "Passou do prazo: o chamado está vencido (pode ser transferido a um analista)" : "Dentro do prazo",
      ],
    };
  },
});
