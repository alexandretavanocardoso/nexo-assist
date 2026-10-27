import { describe, expect, it } from "vitest";
import { isExplicitCancellation, isExplicitConfirmation } from "@/domain/confirmation";
import {
  agentCanReply,
  InvalidTransitionError,
  shouldEscalateForLowConfidence,
  transition,
} from "@/domain/conversation-state";
import { canReopen, checkDuplicates } from "@/domain/ticket-rules";
import type { Category, TicketStatus } from "@/domain/types";
import { brt, NOW } from "../time";

const ticket = (
  number: string,
  title: string,
  category: Category,
  status: TicketStatus,
  resolvedAt: Date | null = null,
  description = "",
) => ({ number, title, description, category, status, resolvedAt });

const ANA_TICKETS = [
  ticket("INC-20311", "Notebook lento após atualização do Windows", "Hardware", "Aguardando analista", null,
    "Lentidão geral desde a atualização do Windows. Reiniciar e rodar o diagnóstico não resolveu."),
  ticket("REQ-10442", "Segundo monitor para home office", "Hardware", "Aprovado"),
  ticket("INC-20150", "Senha do SAP bloqueada", "Acesso", "Resolvido", brt("2026-10-23T10:15")),
  ticket("INC-19877", "Outlook não sincroniza no celular", "E-mail", "Resolvido", brt("2026-09-02T11:00")),
];

describe("sem duplicidade", () => {
  it("acusa chamado aberto sobre o mesmo problema", () => {
    const check = checkDuplicates(
      { title: "Notebook muito lento depois da atualização", description: "Está tudo lento.", category: "Hardware" },
      ANA_TICKETS,
      NOW,
    );
    expect(check.duplicate?.number).toBe("INC-20311");
  });

  it("não confunde problemas diferentes que só compartilham uma palavra", () => {
    const check = checkDuplicates(
      { title: "Notebook não liga", description: "A tela fica preta e a luz não acende.", category: "Hardware" },
      ANA_TICKETS,
      NOW,
    );
    expect(check.duplicate).toBeNull();
  });

  it("não acusa duplicidade para um problema novo", () => {
    const check = checkDuplicates(
      { title: "VPN não conecta com erro 809", description: "Windows 11, desde ontem.", category: "Rede e VPN" },
      ANA_TICKETS,
      NOW,
    );
    expect(check).toEqual({ duplicate: null, possibleDuplicates: [], reopenCandidate: null });
  });

  it("sugere reabrir chamado resolvido há até 7 dias sobre o mesmo problema", () => {
    const check = checkDuplicates(
      { title: "Senha do SAP bloqueou de novo", description: "Bloqueou outra vez hoje.", category: "Acesso" },
      ANA_TICKETS,
      NOW,
    );
    expect(check.duplicate).toBeNull();
    expect(check.reopenCandidate?.number).toBe("INC-20150");
  });
});

describe("reabertura", () => {
  it("permite reabrir chamado resolvido há até 7 dias", () => {
    expect(canReopen({ status: "Resolvido", resolvedAt: brt("2026-10-23T10:15") }, NOW).allowed).toBe(true);
  });

  it("não permite reabrir depois de 7 dias nem chamado que não está resolvido", () => {
    expect(canReopen({ status: "Resolvido", resolvedAt: brt("2026-10-19T10:00") }, NOW).allowed).toBe(false);
    expect(canReopen({ status: "Em andamento", resolvedAt: null }, NOW).allowed).toBe(false);
  });
});

describe("estado da conversa", () => {
  it("segue o fluxo agent → aguardando atendente → analista → agent", () => {
    expect(transition("agent", "transfer")).toBe("waiting_human");
    expect(transition("waiting_human", "assume")).toBe("human");
    expect(transition("human", "release")).toBe("agent");
    expect(transition("human", "close")).toBe("closed");
  });

  it("rejeita transições inválidas", () => {
    expect(() => transition("agent", "assume")).toThrow(InvalidTransitionError);
    expect(() => transition("closed", "release")).toThrow(InvalidTransitionError);
  });

  it("o agent só responde quando a conversa está com ele", () => {
    expect(agentCanReply("agent")).toBe(true);
    expect(agentCanReply("waiting_human")).toBe(false);
    expect(agentCanReply("human")).toBe(false);
  });

  it("transfere após duas respostas seguidas com confiança baixa", () => {
    expect(shouldEscalateForLowConfidence([0.9, 0.45, 0.4])).toBe(true);
    expect(shouldEscalateForLowConfidence([0.4, 0.8])).toBe(false);
    expect(shouldEscalateForLowConfidence([0.4])).toBe(false);
  });
});

describe("confirmação explícita", () => {
  it("aceita respostas curtas e inequívocas", () => {
    for (const text of ["Sim", "pode criar", "Confirmo!", "ok", "Sim, pode abrir."]) {
      expect(isExplicitConfirmation(text), text).toBe(true);
    }
  });

  it("não trata respostas ambíguas como confirmação", () => {
    for (const text of ["sim, mas troca a prioridade", "acho que sim", "não", "pode ser amanhã?"]) {
      expect(isExplicitConfirmation(text), text).toBe(false);
    }
  });

  it("reconhece cancelamento", () => {
    expect(isExplicitCancellation("Cancelar")).toBe(true);
    expect(isExplicitCancellation("não precisa")).toBe(true);
  });
});
