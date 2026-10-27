// Ferramentas de rascunho. O agent NUNCA cria, atualiza ou reabre chamados diretamente:
// ele monta um rascunho, o funcionário confirma (botão ou "sim") e o servidor executa.
// Assim a regra "só criar depois da confirmação" é garantida em código, não no prompt.
import { z } from "zod";
import { formatDue } from "@/domain/business-hours";
import { calculatePriority, explainPriority } from "@/domain/priority";
import { calculateDueDate, SLA_RULES } from "@/domain/sla";
import { canReopen, canUpdate, checkDuplicates } from "@/domain/ticket-rules";
import { categorySchema, impactSchema, ticketTypeSchema, urgencySchema } from "@/domain/types";
import { createDraft } from "@/services/conversations/conversation-service";
import { defineNexoTool } from "../define-tool";
import { callTickets } from "../turn";
import { ticketNumberSchema } from "./chamados";
import { ticketErrorOutput } from "./format";

const CONFIRMATION_RULE = "O chamado só é criado ou alterado depois da confirmação explícita do funcionário";

export const prepararRascunhoChamado = defineNexoTool({
  id: "preparar_rascunho_chamado",
  description:
    "Monta o RASCUNHO de um chamado novo para o funcionário conferir (não cria o chamado). Antes, colete o que falta: " +
    "o que aconteceu, quem é afetado (impacto) e se há algo parado ou compromisso em risco (urgência). " +
    "A prioridade e o prazo são calculados pelas regras do service desk; a ferramenta também barra duplicidade.",
  inputSchema: z.object({
    tipo: ticketTypeSchema.describe(
      "INC = algo parou ou não funciona; REQ = pedido de acesso, equipamento ou software.",
    ),
    titulo: z
      .string()
      .min(5)
      .max(90)
      .describe("Título curto e específico, ex.: 'VPN não conecta no notebook — erro 809'."),
    descricao: z
      .string()
      .min(20)
      .max(800)
      .describe(
        "Descrição completa para o analista não precisar perguntar de novo: o que, desde quando, onde, o que já foi tentado, impacto.",
      ),
    categoria: categorySchema,
    impacto: impactSchema.describe("pessoa = só o funcionário; equipe = a equipe dele; empresa = várias áreas."),
    urgencia: urgencySchema.describe(
      "parado = impede o trabalho; compromisso_hoje = compromisso hoje em risco; atrapalha = há alternativa; sem_urgencia = pedido sem pressa.",
    ),
    nao_e_duplicado_de: z
      .array(ticketNumberSchema)
      .default([])
      .describe("Chamados que o funcionário confirmou serem outro problema (use só depois de perguntar)."),
  }),
  labels: () => ["verificou duplicidade", "classificou a prioridade", "consultou o SLA", "montou o rascunho"],
  run: async (input, turn) => {
    const result = await callTickets(turn, () => turn.tickets.listMine(turn.actor, "all"));
    if (!result.ok) {
      return {
        ...ticketErrorOutput(result.error, result.attempts),
        attempts: result.attempts,
        labels: ["verificou duplicidade"],
      };
    }

    const check = checkDuplicates(
      { title: input.titulo, description: input.descricao, category: input.categoria },
      result.value,
      turn.now,
    );
    if (check.duplicate) {
      return {
        output: {
          ok: false,
          motivo: "duplicado",
          chamado_existente: check.duplicate,
          orientacao:
            "Já existe chamado aberto sobre o mesmo problema. Não abra outro: explique isso e proponha complementar " +
            "o chamado existente com preparar_atualizacao_chamado (ou chamar um analista se estiver vencido).",
        },
        attempts: result.attempts,
        labels: ["verificou duplicidade"],
        rules: [`Sem duplicidade: já existe o ${check.duplicate.number} aberto sobre o mesmo problema`],
      };
    }
    if (check.reopenCandidate) {
      return {
        output: {
          ok: false,
          motivo: "reabrir",
          chamado_resolvido: check.reopenCandidate,
          orientacao: "O mesmo problema foi resolvido há até 7 dias: proponha reabrir com preparar_reabertura_chamado.",
        },
        attempts: result.attempts,
        labels: ["verificou duplicidade"],
        rules: [`Chamados resolvidos há até 7 dias podem ser reabertos (${check.reopenCandidate.number})`],
      };
    }
    const unconfirmed = check.possibleDuplicates.filter((d) => !input.nao_e_duplicado_de.includes(d.number));
    if (unconfirmed.length > 0) {
      return {
        output: {
          ok: false,
          motivo: "possivel_duplicado",
          chamados_parecidos: unconfirmed,
          orientacao:
            "Pergunte ao funcionário se é o mesmo problema. Se for, proponha atualizar o chamado existente; " +
            "se não for, chame de novo informando nao_e_duplicado_de.",
        },
        attempts: result.attempts,
        labels: ["verificou duplicidade"],
        rules: ["Sem duplicidade: chamados parecidos precisam ser descartados antes de abrir outro"],
      };
    }

    const priority = calculatePriority(input.impacto, input.urgencia);
    const dueAt = calculateDueDate(priority, turn.now);
    const draft = createDraft(
      turn.db,
      {
        conversationId: turn.conversationId,
        employeeId: turn.employee.id,
        payload: {
          kind: "create",
          type: input.tipo,
          title: input.titulo,
          description: input.descricao,
          category: input.categoria,
          impact: input.impacto,
          urgency: input.urgencia,
          priority,
          priorityReason: explainPriority(input.impacto, input.urgencia),
          slaLabel: SLA_RULES[priority].label,
          dueAt: dueAt.toISOString(),
        },
      },
      turn.now,
    );
    turn.recorder.addBlock({ type: "draft", draft });

    return {
      output: {
        ok: true,
        rascunho: draft.code,
        prioridade: priority,
        prazo: `${SLA_RULES[priority].label} (resposta até ${formatDue(dueAt, turn.now)})`,
        aguardando_confirmacao: true,
        orientacao:
          "O rascunho já aparece para o funcionário com os botões Confirmar, Editar e Cancelar. Explique a prioridade " +
          "em uma frase e peça para conferir. Não diga que o chamado foi criado.",
      },
      attempts: result.attempts,
      rules: [
        `Prioridade = impacto × urgência → ${explainPriority(input.impacto, input.urgencia)}`,
        `Prazo da prioridade ${priority}: ${SLA_RULES[priority].label}`,
        "Sem duplicidade: nenhum chamado aberto sobre o mesmo problema",
        CONFIRMATION_RULE,
      ],
    };
  },
});

export const prepararAtualizacaoChamado = defineNexoTool({
  id: "preparar_atualizacao_chamado",
  description:
    "Monta o rascunho de um complemento (nova informação) para um chamado ABERTO do funcionário. " +
    "A atualização só acontece depois que o funcionário confirmar.",
  inputSchema: z.object({
    numero: ticketNumberSchema,
    informacao: z.string().min(5).max(800).describe("A nova informação, escrita de forma clara para o analista."),
  }),
  labels: ({ numero }) => [`consultou o ${numero}`, "montou a atualização"],
  run: async ({ numero, informacao }, turn) => {
    const result = await callTickets(turn, () => turn.tickets.getMine(turn.actor, numero));
    if (!result.ok) return { ...ticketErrorOutput(result.error, result.attempts), attempts: result.attempts };
    const { ticket } = result.value;
    const check = canUpdate(ticket);
    if (!check.allowed) {
      return { output: { ok: false, motivo: check.reason }, attempts: result.attempts, rules: [check.reason] };
    }
    const draft = createDraft(
      turn.db,
      {
        conversationId: turn.conversationId,
        employeeId: turn.employee.id,
        payload: { kind: "update", ticketNumber: ticket.number, ticketTitle: ticket.title, note: informacao },
      },
      turn.now,
    );
    turn.recorder.addBlock({ type: "draft", draft });
    return {
      output: { ok: true, rascunho: draft.code, aguardando_confirmacao: true },
      attempts: result.attempts,
      rules: ["Complemento vai para o chamado aberto existente, sem duplicar", CONFIRMATION_RULE],
    };
  },
});

export const prepararReaberturaChamado = defineNexoTool({
  id: "preparar_reabertura_chamado",
  description:
    "Monta o rascunho de reabertura de um chamado RESOLVIDO há até 7 dias, quando o problema voltou. " +
    "Se foi resolvido há mais tempo, a ferramenta recusa e você deve propor um chamado novo.",
  inputSchema: z.object({
    numero: ticketNumberSchema,
    motivo: z.string().min(5).max(500).describe("Por que o problema voltou, nas palavras do funcionário."),
  }),
  labels: ({ numero }) => [`consultou o ${numero}`, "verificou a reabertura"],
  run: async ({ numero, motivo }, turn) => {
    const result = await callTickets(turn, () => turn.tickets.getMine(turn.actor, numero));
    if (!result.ok) return { ...ticketErrorOutput(result.error, result.attempts), attempts: result.attempts };
    const { ticket } = result.value;
    const check = canReopen(ticket, turn.now);
    if (!check.allowed) {
      return { output: { ok: false, motivo: check.reason }, attempts: result.attempts, rules: [check.reason] };
    }
    const draft = createDraft(
      turn.db,
      {
        conversationId: turn.conversationId,
        employeeId: turn.employee.id,
        payload: { kind: "reopen", ticketNumber: ticket.number, ticketTitle: ticket.title, reason: motivo },
      },
      turn.now,
    );
    turn.recorder.addBlock({ type: "draft", draft });
    return {
      output: { ok: true, rascunho: draft.code, aguardando_confirmacao: true },
      attempts: result.attempts,
      labels: [`consultou o ${numero}`, "verificou a reabertura", "montou o rascunho"],
      rules: ["Chamados resolvidos há até 7 dias podem ser reabertos", CONFIRMATION_RULE],
    };
  },
});
