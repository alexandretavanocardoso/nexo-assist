import { describe, expect, it } from "vitest";
import { searchArticles } from "@/services/helpcenter/search";
import {
  ForbiddenError,
  TicketNotFoundError,
  TicketRuleError,
  TicketServiceUnavailableError,
} from "@/services/tickets/errors";
import { withRetry } from "@/services/tickets/retry";
import { toTicketView } from "@/services/tickets/view";
import { ANA, BRUNO, createTestTicketService, RAFAEL } from "../helpers";

describe("autorização por funcionário", () => {
  it("lista só os chamados do próprio funcionário", async () => {
    const { service } = createTestTicketService();
    const numbers = (await service.listMine(ANA)).map((t) => t.number);
    expect(numbers).toContain("INC-20311");
    expect(numbers).not.toContain("INC-20402"); // do Bruno
  });

  it("trata chamado de outro funcionário como inexistente", async () => {
    const { service } = createTestTicketService();
    await expect(service.getMine(ANA, "INC-20402")).rejects.toThrow(TicketNotFoundError);
    await expect(service.addComment(ANA, "INC-20402", "teste")).rejects.toThrow(TicketNotFoundError);
    await expect(service.transfer(ANA, "INC-20402", { level: "N1", summary: "x" })).rejects.toThrow(
      TicketNotFoundError,
    );
  });

  it("não deixa funcionário usar operações de analista", async () => {
    const { service } = createTestTicketService();
    await expect(service.listForEmployee(BRUNO, "e-ana")).rejects.toThrow(ForbiddenError);
    expect((await service.listForEmployee(RAFAEL, "e-ana")).length).toBeGreaterThan(0);
  });
});

describe("criação, atualização e reabertura", () => {
  it("cria chamado com número sequencial e prioridade calculada pela regra", async () => {
    const { service } = createTestTicketService();
    const ticket = await service.create(ANA, {
      type: "INC",
      title: "VPN não conecta com erro 809",
      description: "Windows 11; preciso da VPN para a reunião das 14h.",
      category: "Rede e VPN",
      impact: "pessoa",
      urgency: "compromisso_hoje",
    });
    expect(ticket.number).toBe("INC-20520");
    expect(ticket.priority).toBe("Alta");
    expect(ticket.status).toBe("Aberto");
  });

  it("recusa criar chamado duplicado de um aberto", async () => {
    const { service } = createTestTicketService();
    await expect(
      service.create(ANA, {
        type: "INC",
        title: "Notebook muito lento depois da atualização",
        description: "Continua lento depois da atualização do Windows.",
        category: "Hardware",
        impact: "pessoa",
        urgency: "atrapalha",
      }),
    ).rejects.toThrow(TicketRuleError);
  });

  it("reabre chamado resolvido há 4 dias e recusa o resolvido há 55 dias", async () => {
    const { service } = createTestTicketService();
    const reopened = await service.reopen(ANA, "INC-20150", "Bloqueou de novo");
    expect(reopened.status).toBe("Aguardando analista");
    await expect(service.reopen(ANA, "INC-19877", "Voltou")).rejects.toThrow(TicketRuleError);
  });

  it("complemento do funcionário não reinicia o prazo", async () => {
    const { service, now } = createTestTicketService();
    await service.addComment(ANA, "INC-20311", "Agora também esquenta muito.");
    const { ticket, events } = await service.getMine(ANA, "INC-20311");
    expect(toTicketView(ticket, now).overdue).toBe(true);
    expect(events.at(-1)?.text).toBe("Agora também esquenta muito.");
  });
});

describe("indisponibilidade do sistema legado", () => {
  it("falha durante a queda e volta depois", async () => {
    const { service, gateway } = createTestTicketService();
    gateway.forceOutage(50);
    await expect(service.listMine(ANA)).rejects.toThrow(TicketServiceUnavailableError);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await expect(service.listMine(ANA)).resolves.toBeInstanceOf(Array);
  });

  it("o retry atravessa uma queda curta e informa quantas tentativas foram feitas", async () => {
    const { service, gateway } = createTestTicketService();
    gateway.forceOutage(30);
    const retries: number[] = [];
    const result = await withRetry(() => service.listMine(ANA), {
      baseDelayMs: 20,
      onRetry: ({ attempt }) => retries.push(attempt),
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBeGreaterThan(1);
    expect(retries.length).toBe(result.attempts - 1);
  });

  it("desiste depois do limite e não tenta de novo erros definitivos", async () => {
    const { service, gateway } = createTestTicketService();
    gateway.forceOutage(10_000);
    const down = await withRetry(() => service.listMine(ANA), { retries: 2, baseDelayMs: 1 });
    expect(down).toMatchObject({ ok: false, attempts: 3 });

    const healthy = createTestTicketService().service;
    const notFound = await withRetry(() => healthy.getMine(BRUNO, "INC-20311"), { baseDelayMs: 1 });
    expect(notFound).toMatchObject({ ok: false, attempts: 1 });
  });
});

describe("central de ajuda", () => {
  it("encontra o artigo do erro 809 e o do horário do service desk", () => {
    expect(searchArticles("vpn erro 809")[0]?.article.id).toBe("KB-001");
    expect(searchArticles("qual o horário de atendimento do suporte?")[0]?.article.id).toBe("KB-002");
  });

  it("não devolve artigos para assuntos sem relação", () => {
    expect(searchArticles("quantos dias de férias eu tenho")).toEqual([]);
  });
});
