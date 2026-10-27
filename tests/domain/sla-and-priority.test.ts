import { describe, expect, it } from "vitest";
import { addBusinessMinutes, isWithinBusinessHours } from "@/domain/business-hours";
import { calculatePriority } from "@/domain/priority";
import { calculateDueDate, getSlaStatus } from "@/domain/sla";
import { brt, NOW } from "../time";

describe("horas úteis (seg a sex, 8h às 18h, Brasília)", () => {
  it("soma dentro do mesmo dia", () => {
    expect(addBusinessMinutes(brt("2026-10-27T10:30"), 4 * 60)).toEqual(brt("2026-10-27T14:30"));
  });

  it("pula o fim de semana: sexta 17h + 4h úteis = segunda 11h", () => {
    expect(addBusinessMinutes(brt("2026-10-23T17:00"), 4 * 60)).toEqual(brt("2026-10-26T11:00"));
  });

  it("começa a contar no próximo expediente quando aberto fora do horário", () => {
    expect(addBusinessMinutes(brt("2026-10-27T19:00"), 30)).toEqual(brt("2026-10-28T08:30"));
    expect(addBusinessMinutes(brt("2026-10-24T10:00"), 60)).toEqual(brt("2026-10-26T09:00"));
    expect(addBusinessMinutes(brt("2026-10-27T06:00"), 60)).toEqual(brt("2026-10-27T09:00"));
  });

  it("identifica se está dentro do expediente", () => {
    expect(isWithinBusinessHours(brt("2026-10-27T10:30"))).toBe(true);
    expect(isWithinBusinessHours(brt("2026-10-27T18:00"))).toBe(false);
    expect(isWithinBusinessHours(brt("2026-10-25T10:00"))).toBe(false);
  });
});

describe("prioridade = impacto x urgência (Anexo A)", () => {
  it("algo parado para uma equipe ou para a empresa é Crítica", () => {
    expect(calculatePriority("equipe", "parado")).toBe("Crítica");
    expect(calculatePriority("empresa", "parado")).toBe("Crítica");
  });

  it("impede uma pessoa de trabalhar ou há compromisso hoje é Alta", () => {
    expect(calculatePriority("pessoa", "parado")).toBe("Alta");
    expect(calculatePriority("pessoa", "compromisso_hoje")).toBe("Alta");
  });

  it("atrapalha mas há alternativa é Média; pedido sem urgência é Baixa", () => {
    expect(calculatePriority("pessoa", "atrapalha")).toBe("Média");
    expect(calculatePriority("equipe", "atrapalha")).toBe("Média");
    expect(calculatePriority("pessoa", "sem_urgencia")).toBe("Baixa");
  });
});

describe("prazos (SLA) e chamado vencido", () => {
  it("Crítica tem 1 hora corrida, mesmo fora do expediente (plantão 24h)", () => {
    expect(calculateDueDate("Crítica", brt("2026-10-24T22:00"))).toEqual(brt("2026-10-24T23:00"));
  });

  it("Alta tem 4 horas úteis", () => {
    expect(calculateDueDate("Alta", brt("2026-10-27T10:30"))).toEqual(brt("2026-10-27T14:30"));
  });

  it("Média tem 3 dias úteis e Baixa 5 dias úteis (1 dia útil = 10 h)", () => {
    expect(calculateDueDate("Média", brt("2026-10-27T10:30"))).toEqual(brt("2026-10-30T10:30"));
    expect(calculateDueDate("Baixa", brt("2026-10-27T10:30"))).toEqual(brt("2026-11-03T10:30"));
  });

  it("INC-20311: Média sem atualização há 6 dias está vencido", () => {
    const sla = getSlaStatus(
      { priority: "Média", status: "Aguardando analista", lastServiceUpdateAt: brt("2026-10-21T09:10") },
      NOW,
    );
    expect(sla.dueAt).toEqual(brt("2026-10-26T09:10"));
    expect(sla.overdue).toBe(true);
  });

  it("chamado resolvido não tem prazo nem fica vencido", () => {
    const sla = getSlaStatus(
      { priority: "Alta", status: "Resolvido", lastServiceUpdateAt: brt("2026-10-01T09:00") },
      NOW,
    );
    expect(sla).toMatchObject({ dueAt: null, overdue: false });
  });
});
