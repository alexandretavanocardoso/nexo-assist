import { z } from "zod";
import { formatDue } from "@/domain/business-hours";
import { buildHandoff, levelFor } from "@/services/conversations/handoff";
import { HANDOFF_REASON_LABELS, HANDOFF_REASONS } from "@/services/conversations/types";
import { defineNexoTool } from "../define-tool";
import { callTickets } from "../turn";
import { ticketNumberSchema } from "./chamados";
import { ticketErrorOutput } from "./format";

export const transferirParaAnalista = defineNexoTool({
  id: "transferir_para_analista",
  description:
    "Transfere a conversa para um analista humano, levando um resumo do caso. Use quando: o funcionário pedir; " +
    "for caso crítico; o chamado estiver vencido e o funcionário quiser; ou você não tiver segurança sobre o que fazer. " +
    "Depois da transferência você para de responder.",
  inputSchema: z.object({
    motivo: z.enum(HANDOFF_REASONS),
    resumo: z
      .string()
      .min(30)
      .max(600)
      .describe(
        "Resumo para o analista não perguntar tudo de novo: problema, o que já foi verificado, chamado e prazo.",
      ),
    numero: ticketNumberSchema.optional().describe("Chamado relacionado, se houver."),
  }),
  labels: () => ["transferiu para um analista"],
  run: async ({ motivo, resumo, numero }, turn) => {
    let ticketPriority = null;
    let attempts = 1;
    if (numero) {
      const result = await callTickets(turn, () =>
        turn.tickets.transfer(turn.actor, numero, { level: levelFor(motivo), summary: resumo }),
      );
      attempts = result.attempts;
      if (!result.ok) return { ...ticketErrorOutput(result.error, result.attempts), attempts };
      ticketPriority = result.value.priority;
    }

    const handoff = buildHandoff({
      reason: motivo,
      summary: resumo,
      ticketNumber: numero ?? null,
      ticketPriority,
      confidence: turn.recorder.decision?.confidence ?? null,
      now: turn.now,
    });
    turn.recorder.handoff = handoff;

    return {
      output: {
        ok: true,
        nivel: `Suporte ${handoff.level}`,
        contato_ate: formatDue(new Date(handoff.contactDueAt), turn.now),
        orientacao:
          "Diga que encaminhou para o Suporte com o resumo do caso e até quando um analista fala com ele por aqui. " +
          "Não faça mais perguntas.",
      },
      attempts,
      rules: [
        `Transferência: ${HANDOFF_REASON_LABELS[motivo].toLowerCase()}`,
        `Casos críticos e chamados vencidos vão para o N2; os demais para o N1 (${handoff.level})`,
        "O agent fica pausado enquanto a conversa está com um analista",
      ],
    };
  },
});
