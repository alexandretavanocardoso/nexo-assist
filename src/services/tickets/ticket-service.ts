// Serviço de chamados: a "API" do sistema legado simulado.
// - Separado do agent: o agent só chega aqui pelas ferramentas.
// - Autorização em código: funcionário só enxerga e altera os próprios chamados.
//   Chamado de outro funcionário é tratado como inexistente (não vaza nem o número).
// - Regras do service desk aplicadas de novo aqui (defesa em profundidade).
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { calculatePriority } from "@/domain/priority";
import { canReopen, canUpdate, checkDuplicates } from "@/domain/ticket-rules";
import {
  categorySchema,
  impactSchema,
  isOpenStatus,
  ticketTypeSchema,
  urgencySchema,
  type Actor,
  type SupportLevel,
} from "@/domain/types";
import type { Db } from "@/server/db/client";
import { ticketEvents, tickets } from "@/server/db/schema";
import { ForbiddenError, TicketNotFoundError, TicketRuleError } from "./errors";
import type { LegacyGateway } from "./legacy-gateway";
import type { NewTicketInput, Ticket, TicketEvent } from "./types";

export const newTicketSchema = z.object({
  type: ticketTypeSchema,
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(2000),
  category: categorySchema,
  impact: impactSchema,
  urgency: urgencySchema,
});

const FIRST_NUMBER = { INC: 20000, REQ: 10000 } as const;

export class TicketService {
  constructor(
    private readonly db: Db,
    private readonly gateway: LegacyGateway,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // --- Operações do funcionário (sempre restritas aos chamados dele) ---

  async listMine(actor: Actor, scope: "open" | "all" = "all"): Promise<Ticket[]> {
    assertEmployee(actor);
    return this.gateway.call("listar", () => {
      const rows = this.db
        .select()
        .from(tickets)
        .where(eq(tickets.requesterId, actor.id))
        .orderBy(desc(tickets.updatedAt))
        .all();
      return scope === "open" ? rows.filter((t) => isOpenStatus(t.status)) : rows;
    });
  }

  async getMine(actor: Actor, number: string): Promise<{ ticket: Ticket; events: TicketEvent[] }> {
    assertEmployee(actor);
    return this.gateway.call("consultar", () => {
      const ticket = this.findOwned(actor.id, number);
      return { ticket, events: this.eventsOf(ticket.id) };
    });
  }

  async create(actor: Actor, input: NewTicketInput): Promise<Ticket> {
    assertEmployee(actor);
    const data = newTicketSchema.parse(input);
    return this.gateway.call("criar", () =>
      this.db.transaction((tx) => {
        const now = this.clock();
        const mine = tx.select().from(tickets).where(eq(tickets.requesterId, actor.id)).all();
        const { duplicate } = checkDuplicates(data, mine, now);
        if (duplicate) {
          throw new TicketRuleError(
            `Já existe o chamado aberto ${duplicate.number} sobre o mesmo problema; ele deve ser atualizado.`,
          );
        }
        const all = tx.select({ number: tickets.number }).from(tickets).where(eq(tickets.type, data.type)).all();
        const last = Math.max(FIRST_NUMBER[data.type], ...all.map((t) => Number(t.number.split("-")[1])));
        const ticket: Ticket = {
          id: randomUUID(),
          number: `${data.type}-${last + 1}`,
          ...data,
          priority: calculatePriority(data.impact, data.urgency),
          status: "Aberto",
          requesterId: actor.id,
          assignedLevel: null,
          createdAt: now,
          lastServiceUpdateAt: now,
          updatedAt: now,
          resolvedAt: null,
        };
        tx.insert(tickets).values(ticket).run();
        tx.insert(ticketEvents)
          .values(event(ticket.id, "created", "employee", "Chamado aberto pelo Nexo Assist", now))
          .run();
        return ticket;
      }),
    );
  }

  /** Complemento do funcionário. Não reinicia o prazo: o prazo conta a partir das ações do service desk. */
  async addComment(actor: Actor, number: string, text: string): Promise<Ticket> {
    assertEmployee(actor);
    return this.gateway.call("atualizar", () => {
      const ticket = this.findOwned(actor.id, number);
      const check = canUpdate(ticket);
      if (!check.allowed) throw new TicketRuleError(check.reason);
      const now = this.clock();
      this.db.update(tickets).set({ updatedAt: now }).where(eq(tickets.id, ticket.id)).run();
      this.db
        .insert(ticketEvents)
        .values(event(ticket.id, "comment", "employee", text, now))
        .run();
      return { ...ticket, updatedAt: now };
    });
  }

  async reopen(actor: Actor, number: string, reason: string): Promise<Ticket> {
    assertEmployee(actor);
    return this.gateway.call("reabrir", () => {
      const ticket = this.findOwned(actor.id, number);
      const now = this.clock();
      const check = canReopen(ticket, now);
      if (!check.allowed) throw new TicketRuleError(check.reason);
      const changes = {
        status: "Aguardando analista" as const,
        resolvedAt: null,
        lastServiceUpdateAt: now,
        updatedAt: now,
      };
      this.db.update(tickets).set(changes).where(eq(tickets.id, ticket.id)).run();
      this.db
        .insert(ticketEvents)
        .values(event(ticket.id, "reopened", "employee", `Reaberto: ${reason}`, now))
        .run();
      return { ...ticket, ...changes };
    });
  }

  /** Encaminha o chamado para a fila de um nível de suporte, com o resumo do caso. */
  async transfer(actor: Actor, number: string, input: { level: SupportLevel; summary: string }): Promise<Ticket> {
    assertEmployee(actor);
    return this.gateway.call("transferir", () => {
      const ticket = this.findOwned(actor.id, number);
      const now = this.clock();
      const changes = {
        assignedLevel: input.level,
        status: ticket.status === "Aberto" ? ("Aguardando analista" as const) : ticket.status,
        updatedAt: now,
      };
      this.db.update(tickets).set(changes).where(eq(tickets.id, ticket.id)).run();
      this.db
        .insert(ticketEvents)
        .values(event(ticket.id, "transferred", "system", `Transferido para um analista (Suporte ${input.level})`, now))
        .run();
      return { ...ticket, ...changes };
    });
  }

  // --- Operações do analista ---

  async listForEmployee(analyst: Actor, employeeId: string): Promise<Array<{ ticket: Ticket; events: TicketEvent[] }>> {
    assertAnalyst(analyst);
    return this.gateway.call("listar", () =>
      this.db
        .select()
        .from(tickets)
        .where(eq(tickets.requesterId, employeeId))
        .orderBy(desc(tickets.updatedAt))
        .all()
        .map((ticket) => ({ ticket, events: this.eventsOf(ticket.id) })),
    );
  }

  /** O analista assumiu o atendimento: é uma ação do service desk, então reinicia o prazo. */
  async markInService(analyst: Actor, number: string, analystName: string): Promise<void> {
    assertAnalyst(analyst);
    await this.gateway.call("assumir", () => {
      const ticket = this.db.select().from(tickets).where(eq(tickets.number, number)).get();
      if (!ticket || !isOpenStatus(ticket.status)) return;
      const now = this.clock();
      this.db
        .update(tickets)
        .set({ status: "Em andamento", lastServiceUpdateAt: now, updatedAt: now })
        .where(eq(tickets.id, ticket.id))
        .run();
      this.db
        .insert(ticketEvents)
        .values(event(ticket.id, "status", "analyst", `Assumido por ${analystName}`, now))
        .run();
    });
  }

  // --- Internos ---

  private findOwned(requesterId: string, number: string): Ticket {
    const ticket = this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.requesterId, requesterId), eq(tickets.number, number.trim().toUpperCase())))
      .get();
    if (!ticket) throw new TicketNotFoundError(number);
    return ticket;
  }

  private eventsOf(ticketId: string): TicketEvent[] {
    return this.db
      .select()
      .from(ticketEvents)
      .where(eq(ticketEvents.ticketId, ticketId))
      .orderBy(asc(ticketEvents.createdAt))
      .all();
  }
}

function assertEmployee(actor: Actor): void {
  if (actor.role !== "employee") throw new ForbiddenError("Só funcionários operam os próprios chamados pelo chat.");
}

function assertAnalyst(actor: Actor): void {
  if (actor.role !== "analyst") throw new ForbiddenError("Apenas analistas podem ver chamados de outros funcionários.");
}

function event(
  ticketId: string,
  kind: TicketEvent["kind"],
  author: TicketEvent["author"],
  text: string,
  createdAt: Date,
): TicketEvent {
  return { id: randomUUID(), ticketId, kind, author, text, createdAt };
}
