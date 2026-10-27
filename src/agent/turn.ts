// Contexto de um turno do agent. É passado para as ferramentas pelo RequestContext do Mastra.
// O funcionário (actor) vem da sessão autenticada; as ferramentas nunca recebem
// "de quem é o chamado" do modelo, então o LLM não consegue pedir dados de outra pessoa.
import { randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/request-context";
import type { StreamEvent } from "@/lib/stream-events";
import type { Actor } from "@/domain/types";
import type { Db } from "@/server/db/client";
import type { Employee } from "@/services/employees";
import type { Handoff, UiBlock } from "@/services/conversations/types";
import { withRetry, type RetryResult } from "@/services/tickets/retry";
import type { TicketService } from "@/services/tickets/ticket-service";
import type { Intent, TraceStep } from "./trace";

export type Decision = {
  intent: Intent;
  understood: string;
  action: string;
  confidence: number;
  rationale: string;
};

export type TurnContext = {
  actor: Actor;
  employee: Employee;
  conversationId: string;
  now: Date;
  db: Db;
  tickets: TicketService;
  recorder: TurnRecorder;
  emit: (event: StreamEvent) => void;
  /** Espera entre tentativas no sistema de chamados (menor nos testes). */
  retryBaseDelayMs?: number;
};

/** Junta tudo o que aconteceu no turno para montar o decision trace e a resposta. */
export class TurnRecorder {
  decision: Decision | null = null;
  readonly steps: TraceStep[] = [];
  readonly blocks: UiBlock[] = [];
  /** Preenchido quando o agent decidiu transferir para um analista. */
  handoff: Handoff | null = null;

  constructor(private readonly emit: (event: StreamEvent) => void) {}

  addBlock(block: UiBlock): void {
    // Opções rápidas e seletores só fazem sentido uma vez por resposta: o último vale.
    const index = this.blocks.findIndex((b) => b.type === block.type && block.type !== "ticket-card");
    if (index >= 0) this.blocks.splice(index, 1);
    this.blocks.push(block);
    this.emit({ type: "block", block });
  }

  startStep(tool: string, labels: string[], input: unknown) {
    const id = randomUUID();
    const startedAt = Date.now();
    if (labels.length > 0) this.emit({ type: "step", step: { id, labels, status: "running" } });
    return {
      finish: (result: { output: unknown; status: "ok" | "error"; attempts: number; rules: string[]; labels?: string[] }) => {
        const finalLabels = result.labels ?? labels;
        this.steps.push({
          id,
          tool,
          labels: finalLabels,
          input,
          output: result.output,
          status: result.status,
          attempts: result.attempts,
          durationMs: Date.now() - startedAt,
          rules: result.rules,
        });
        if (finalLabels.length > 0 || labels.length > 0) {
          this.emit({ type: "step", step: { id, labels: finalLabels, status: result.status === "ok" ? "done" : "error" } });
        }
      },
    };
  }
}

export type NexoRequestContext = { turn: TurnContext };

export function createRequestContext(turn: TurnContext): RequestContext<NexoRequestContext> {
  const requestContext = new RequestContext<NexoRequestContext>();
  requestContext.set("turn", turn);
  return requestContext;
}

/**
 * Chama o sistema de chamados com retry. A cada nova tentativa avisa o funcionário,
 * para ele saber por que a resposta está demorando.
 */
export function callTickets<T>(turn: TurnContext, run: () => Promise<T>): Promise<RetryResult<T>> {
  return withRetry(run, {
    baseDelayMs: turn.retryBaseDelayMs,
    onRetry: ({ attempt, maxAttempts }) =>
      turn.emit({
        type: "notice",
        text: `O sistema de chamados está instável. Tentando de novo (${attempt + 1}/${maxAttempts})…`,
      }),
  });
}
