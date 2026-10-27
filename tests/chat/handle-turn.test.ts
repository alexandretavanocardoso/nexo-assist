import { describe, expect, it } from "vitest";
import { createNexoAgent } from "@/agent/nexo-agent";
import type { StreamEvent } from "@/lib/stream-events";
import { ChatError, handleEmployeeTurn, type ChatInput } from "@/server/chat/handle-turn";
import { findEmployeeById } from "@/services/employees";
import { getOrCreateActiveConversation, toConversationView } from "@/services/conversations/conversation-service";
import { createTestTicketService } from "../helpers";
import { decide, scriptedModel, type ScriptStep } from "../support/scripted-model";

function setup(script: ScriptStep[]) {
  const env = createTestTicketService();
  const scripted = scriptedModel(script);
  const agent = createNexoAgent(scripted.model);
  const ana = findEmployeeById(env.db, "e-ana")!;
  const events: StreamEvent[] = [];
  const deps = { db: env.db, tickets: env.service, getAgent: () => agent, now: () => env.now, retryBaseDelayMs: 1 };
  const send = (input: ChatInput) => handleEmployeeTurn(deps, ana, input, (e) => events.push(e));
  const conversation = () => toConversationView(env.db, getOrCreateActiveConversation(env.db, "e-ana", env.now));
  const lastAnswer = () => conversation().messages.findLast((m) => m.role === "assistant")!;
  return { ...env, scripted, events, send, conversation, lastAnswer };
}

describe("turno do agent (modelo roteirizado)", () => {
  it("consulta sem número: lista, consulta, mostra o cartão vencido e registra o trace", async () => {
    const t = setup([
      { toolCalls: [decide("consulta"), { name: "listar_meus_chamados", input: { busca: "notebook lento" } }] },
      { toolCalls: [{ name: "consultar_chamado", input: { numero: "inc-20311" } }] },
      { text: "O INC-20311 está vencido. Quer que eu chame um analista?" },
    ]);
    await t.send({ kind: "message", text: "como está o chamado do meu notebook lento?" });

    const answer = t.lastAnswer();
    expect(answer.text).toContain("vencido");
    expect(answer.trace?.intent).toBe("consulta");
    expect(answer.trace?.confidence).toBe(0.9);
    expect(answer.trace?.steps.map((s) => s.tool)).toEqual(["registrar_decisao", "listar_meus_chamados", "consultar_chamado"]);
    const card = answer.blocks.find((b) => b.type === "ticket-card");
    expect(card?.type === "ticket-card" && card.ticket).toMatchObject({ number: "INC-20311", overdue: true });
    expect(t.events.some((e) => e.type === "step" && e.step.labels.includes("consultou seus chamados"))).toBe(true);
    expect(t.events.at(-1)?.type).toBe("done");
  });

  it("o modelo recebe as instruções e o contexto do funcionário, mas nunca escolhe o dono do chamado", async () => {
    const t = setup([{ toolCalls: [decide("saudacao")] }, { text: "Olá!" }]);
    await t.send({ kind: "message", text: "oi" });
    const prompt = JSON.stringify(t.scripted.calls[0]?.prompt);
    expect(prompt).toContain("Nexo Assist");
    expect(prompt).toContain("Ana Souza");
    expect(prompt).toContain("Windows 11");
    const listTool = t.scripted.calls[0]?.tools?.find((tool) => tool.name === "listar_meus_chamados");
    expect(JSON.stringify(listTool)).not.toMatch(/funcionario|employee|email|requester/i);
  });

  it("privacidade: chamado de outro funcionário é tratado como inexistente", async () => {
    const t = setup([
      { toolCalls: [decide("consulta"), { name: "consultar_chamado", input: { numero: "INC-20402" } }] },
      { text: "Não encontrei esse chamado entre os seus." },
    ]);
    await t.send({ kind: "message", text: "qual o status do INC-20402?" });

    const answer = t.lastAnswer();
    const step = answer.trace?.steps.find((s) => s.tool === "consultar_chamado");
    expect(step?.output).toMatchObject({ ok: false, erro: "nao_encontrado" });
    expect(JSON.stringify(answer)).not.toContain("VPN cai a cada 10 minutos");
    expect(answer.blocks.some((b) => b.type === "ticket-card")).toBe(false);
  });

  it("abertura: monta rascunho com prioridade calculada e só cria depois do 'sim', sem chamar o modelo", async () => {
    const t = setup([
      {
        toolCalls: [
          decide("abertura"),
          {
            name: "preparar_rascunho_chamado",
            input: {
              tipo: "INC",
              titulo: "VPN não conecta no notebook — erro 809",
              descricao: "Desde ontem o notebook (Windows 11) não conecta na VPN, erro 809. Reunião com cliente às 14h.",
              categoria: "Rede e VPN",
              impacto: "pessoa",
              urgencia: "compromisso_hoje",
            },
          },
        ],
      },
      { text: "Coloquei prioridade alta por causa da reunião. Confira antes de eu criar:" },
    ]);
    await t.send({ kind: "message", text: "minha VPN não conecta, erro 809, tenho reunião às 14h" });

    const draftBlock = t.lastAnswer().blocks.find((b) => b.type === "draft");
    expect(draftBlock?.type === "draft" && draftBlock.draft.payload).toMatchObject({ kind: "create", priority: "Alta" });
    expect((await t.service.listMine({ id: "e-ana", role: "employee" }, "open")).some((x) => x.title.includes("VPN"))).toBe(false);

    const modelCalls = t.scripted.calls.length;
    await t.send({ kind: "message", text: "Sim, pode criar" });
    expect(t.scripted.calls.length).toBe(modelCalls);
    const answer = t.lastAnswer();
    expect(answer.text).toContain("INC-20520");
    expect(answer.trace).toMatchObject({ source: "server", intent: "confirmacao", confidence: 1 });
    const draft = t.conversation().messages.flatMap((m) => m.blocks).find((b) => b.type === "draft");
    expect(draft?.type === "draft" && draft.draft.status).toBe("committed");
  });

  it("duplicidade: a ferramenta barra o rascunho quando já existe chamado aberto sobre o mesmo problema", async () => {
    const t = setup([
      {
        toolCalls: [
          decide("abertura"),
          {
            name: "preparar_rascunho_chamado",
            input: {
              tipo: "INC",
              titulo: "Notebook lento depois da atualização",
              descricao: "O notebook ficou muito lento depois da atualização do Windows.",
              categoria: "Hardware",
              impacto: "pessoa",
              urgencia: "atrapalha",
            },
          },
        ],
      },
      { text: "Você já tem o INC-20311 sobre isso. Quer complementar?" },
    ]);
    await t.send({ kind: "message", text: "quero abrir chamado, notebook lento depois da atualização" });
    const answer = t.lastAnswer();
    expect(answer.blocks.some((b) => b.type === "draft")).toBe(false);
    expect(answer.trace?.steps.at(-1)?.output).toMatchObject({ ok: false, motivo: "duplicado" });
  });

  it("caso crítico: depois da confirmação cria o chamado e transfere para o N2", async () => {
    const t = setup([
      {
        toolCalls: [
          decide("abertura"),
          {
            name: "preparar_rascunho_chamado",
            input: {
              tipo: "INC",
              titulo: "Sistema de faturamento fora do ar para o Financeiro",
              descricao: "Ninguém da equipe financeira consegue emitir notas fiscais no sistema de faturamento desde 9h.",
              categoria: "Software",
              impacto: "equipe",
              urgencia: "parado",
            },
          },
        ],
      },
      { text: "Confira o rascunho:" },
    ]);
    await t.send({ kind: "message", text: "o faturamento parou para toda a equipe" });
    const draft = t.lastAnswer().blocks.find((b) => b.type === "draft");
    if (draft?.type !== "draft") throw new Error("rascunho não criado");
    expect(draft.draft.payload).toMatchObject({ priority: "Crítica" });

    await t.send({ kind: "confirm-draft", draftId: draft.draft.id });
    const view = t.conversation();
    expect(view.status).toBe("waiting_human");
    expect(view.handoff).toMatchObject({ reason: "caso_critico", level: "N2", priority: "Crítica" });
    expect(view.messages.at(-1)).toMatchObject({ role: "system", text: "Transferida para Suporte N2" });
  });

  it("depois da transferência o agent para de responder", async () => {
    const t = setup([
      {
        toolCalls: [
          decide("transferencia"),
          { name: "transferir_para_analista", input: { motivo: "pedido_do_funcionario", resumo: "Ana pediu para falar com um analista sobre o notebook lento (INC-20311)." } },
        ],
      },
      { text: "Encaminhei para o Suporte N1." },
    ]);
    await t.send({ kind: "message", text: "quero falar com um analista" });
    expect(t.conversation().status).toBe("waiting_human");

    const modelCalls = t.scripted.calls.length;
    await t.send({ kind: "message", text: "alguém aí?" });
    expect(t.scripted.calls.length).toBe(modelCalls);
    expect(t.conversation().messages.at(-1)).toMatchObject({ role: "user", text: "alguém aí?" });
  });

  it("indisponibilidade: tenta de novo, avisa o funcionário e registra as tentativas", async () => {
    const t = setup([
      { toolCalls: [decide("consulta"), { name: "listar_meus_chamados", input: {} }] },
      { text: "O sistema de chamados está fora do ar agora. Tente de novo em alguns instantes." },
    ]);
    t.gateway.forceOutage(60_000);
    await t.send({ kind: "message", text: "quais são meus chamados?" });

    const step = t.lastAnswer().trace?.steps.find((s) => s.tool === "listar_meus_chamados");
    expect(step).toMatchObject({ status: "error", attempts: 4, output: { erro: "sistema_indisponivel" } });
    expect(t.events.filter((e) => e.type === "notice")).toHaveLength(3);
  });

  it("limite de 30 mensagens por sessão", async () => {
    const t = setup([]);
    const conversation = getOrCreateActiveConversation(t.db, "e-ana", t.now);
    t.db.$client.prepare("update conversations set user_message_count = 30 where id = ?").run(conversation.id);
    await expect(t.send({ kind: "message", text: "oi" })).rejects.toThrow(ChatError);
  });

  it("baixa confiança duas vezes seguidas transfere automaticamente", async () => {
    const t = setup([
      { toolCalls: [decide("outro", 0.4)] },
      { text: "Pode explicar melhor?" },
      { toolCalls: [decide("outro", 0.35)] },
      { text: "Ainda não entendi." },
    ]);
    await t.send({ kind: "message", text: "a coisa do sistema tá estranha" });
    expect(t.conversation().status).toBe("agent");
    await t.send({ kind: "message", text: "aquela coisa lá" });
    expect(t.conversation()).toMatchObject({ status: "waiting_human", handoff: { reason: "baixa_confianca" } });
  });
});
