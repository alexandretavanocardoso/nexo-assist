// Orquestra um turno do chat do funcionário. As regras que não podem depender do modelo
// ficam aqui, em código:
// - limite de 30 mensagens por sessão;
// - o agent não responde enquanto a conversa está com um analista;
// - confirmação/cancelamento de rascunho executados pelo servidor;
// - transferência automática por baixa confiança.
import type { Agent } from "@mastra/core/agent";
import { buildModelMessages } from "@/agent/history";
import { EFFORT, estimateCostUsd, MissingApiKeyError, MODEL_ID } from "@/agent/model";
import { emptyMetrics, type DecisionTrace } from "@/agent/trace";
import { createRequestContext, TurnRecorder, type TurnContext } from "@/agent/turn";
import { isExplicitCancellation, isExplicitConfirmation } from "@/domain/confirmation";
import { agentCanReply, MESSAGE_LIMIT, shouldEscalateForLowConfidence } from "@/domain/conversation-state";
import type { StreamEvent } from "@/lib/stream-events";
import type { Db } from "@/server/db/client";
import { logger } from "@/server/logger";
import {
  addMessage,
  findOwnedDraft,
  findPendingDraft,
  getConversation,
  getOrCreateActiveConversation,
  hasReachedMessageLimit,
  listMessages,
  toConversationView,
  type Conversation,
} from "@/services/conversations/conversation-service";
import { buildHandoff } from "@/services/conversations/handoff";
import type { DraftView } from "@/services/conversations/types";
import type { Employee } from "@/services/employees";
import type { TicketService } from "@/services/tickets/ticket-service";
import { cancelDraft, commitDraft } from "./draft-actions";
import { transferConversation } from "./transfer";

export type ChatInput =
  | { kind: "message"; text: string }
  | { kind: "confirm-draft"; draftId: string }
  | { kind: "cancel-draft"; draftId: string }
  /** Roda o agent de novo para a última mensagem, depois de um erro. */
  | { kind: "retry" };

export type ChatDeps = {
  db: Db;
  tickets: TicketService;
  /** Função para que a falta de chave da API vire uma mensagem de erro clara no chat. */
  getAgent: () => Agent;
  now?: () => Date;
  retryBaseDelayMs?: number;
};

const MAX_AGENT_STEPS = 8;

export class ChatError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

export async function handleEmployeeTurn(
  deps: ChatDeps,
  employee: Employee,
  input: ChatInput,
  emit: (event: StreamEvent) => void,
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const conversation = getOrCreateActiveConversation(deps.db, employee.id, now);
  const turn: TurnContext = {
    actor: { id: employee.id, role: "employee" },
    employee,
    conversationId: conversation.id,
    now,
    db: deps.db,
    tickets: deps.tickets,
    recorder: new TurnRecorder(emit),
    emit,
    retryBaseDelayMs: deps.retryBaseDelayMs,
  };

  try {
    await routeInput(deps, turn, conversation, input);
  } catch (error) {
    if (!(error instanceof ChatError)) logger.error("chat.turn_failed", { conversationId: conversation.id, error });
    emit(
      error instanceof ChatError
        ? { type: "error", code: error.code, message: error.message, retryable: error.retryable }
        : {
            type: "error",
            code: "internal",
            message: "Algo deu errado do nosso lado. Tente de novo.",
            retryable: true,
          },
    );
  } finally {
    emit({ type: "done", conversation: toConversationView(deps.db, getConversation(deps.db, conversation.id)) });
  }
}

async function routeInput(deps: ChatDeps, turn: TurnContext, conversation: Conversation, input: ChatInput) {
  const { db } = turn;

  if (input.kind === "retry") {
    const last = listMessages(db, conversation.id).at(-1);
    if (last?.role !== "user" || !agentCanReply(conversation.status)) return;
    await runAgent(deps, turn, conversation);
    return;
  }

  if (input.kind === "confirm-draft" || input.kind === "cancel-draft") {
    if (!agentCanReply(conversation.status)) throw new ChatError("with_analyst", "A conversa está com um analista.");
    const draft = findOwnedDraft(db, input.draftId, turn.employee.id, conversation.id);
    if (!draft || draft.status !== "pending") {
      throw new ChatError("draft_not_pending", "Esse rascunho não está mais aguardando confirmação.");
    }
    const confirm = input.kind === "confirm-draft";
    saveUserMessage(turn, confirm ? `Confirmar rascunho ${draft.code}` : `Cancelar rascunho ${draft.code}`);
    if (confirm) await commitDraft(turn, draft);
    else cancelDraft(turn, draft);
    return;
  }

  if (hasReachedMessageLimit(conversation)) {
    throw new ChatError(
      "message_limit",
      `Você chegou ao limite de ${MESSAGE_LIMIT} mensagens desta sessão. Comece uma nova conversa para continuar.`,
    );
  }
  const draftShown = draftShownInLastAnswer(db, conversation.id);
  saveUserMessage(turn, input.text);

  // Com um analista: a mensagem fica no histórico para ele, e o agent não responde.
  if (!agentCanReply(conversation.status)) return;

  // "sim" logo depois do rascunho confirma; "cancelar" descarta. O resto vai para o agent.
  if (draftShown && isExplicitConfirmation(input.text)) return commitDraft(turn, draftShown);
  if (draftShown && isExplicitCancellation(input.text)) return cancelDraft(turn, draftShown);

  await runAgent(deps, turn, conversation);
}

function saveUserMessage(turn: TurnContext, text: string) {
  const message = addMessage(
    turn.db,
    { conversationId: turn.conversationId, role: "user", authorId: turn.employee.id, text },
    turn.now,
  );
  turn.emit({
    type: "user-message",
    message: {
      id: message.id,
      role: "user",
      text,
      blocks: [],
      trace: null,
      author: { name: turn.employee.name, label: null },
      createdAt: message.createdAt.toISOString(),
    },
  });
}

/** Rascunho pendente que aparece na última resposta (só ele pode ser confirmado com um "sim"). */
function draftShownInLastAnswer(db: Db, conversationId: string): DraftView | undefined {
  const pending = findPendingDraft(db, conversationId);
  if (!pending) return undefined;
  const lastAnswer = listMessages(db, conversationId).findLast((m) => m.role === "assistant");
  const shown = lastAnswer?.blocks.some((b) => b.type === "draft" && b.draft.id === pending.id);
  return shown ? pending : undefined;
}

async function runAgent(deps: ChatDeps, turn: TurnContext, conversation: Conversation): Promise<void> {
  const { db, now, recorder, emit } = turn;
  const startedAt = Date.now();
  let firstTokenAt: number | null = null;
  let text = "";

  const current = getConversation(db, conversation.id);
  const messages = buildModelMessages({
    history: listMessages(db, conversation.id),
    employee: turn.employee,
    now,
    pendingDraft: findPendingDraft(db, conversation.id),
    userMessageCount: current.userMessageCount,
    messageLimit: MESSAGE_LIMIT,
  });

  let usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  try {
    const stream = await deps.getAgent().stream(messages, {
      requestContext: createRequestContext(turn),
      maxSteps: MAX_AGENT_STEPS,
      providerOptions: { anthropic: { effort: EFFORT } },
      modelSettings: { maxOutputTokens: 1200 },
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === "text-start" && text && !text.endsWith("\n")) {
        // Texto depois de uma ferramenta começa um novo parágrafo.
        text += "\n\n";
        emit({ type: "text-delta", text: "\n\n" });
      } else if (chunk.type === "text-delta") {
        firstTokenAt ??= Date.now();
        text += chunk.payload.text;
        emit({ type: "text-delta", text: chunk.payload.text });
      } else if (chunk.type === "error") {
        throw chunk.payload.error;
      }
    }
    const total = await stream.totalUsage;
    usage = {
      inputTokens: total.inputTokens ?? 0,
      outputTokens: total.outputTokens ?? 0,
      cachedInputTokens: total.cachedInputTokens ?? 0,
    };
  } catch (error) {
    logger.error("agent.turn_failed", { conversationId: conversation.id, error });
    if (error instanceof MissingApiKeyError) throw new ChatError("missing_api_key", error.message);
    throw new ChatError(
      "agent_unavailable",
      "O assistente não conseguiu responder agora. Tente de novo em instantes.",
      true,
    );
  }

  const decision = recorder.decision;
  if (!decision) logger.warn("agent.decision_missing", { conversationId: conversation.id });
  const trace: DecisionTrace = {
    source: "agent",
    intent: decision?.intent ?? null,
    understood: decision?.understood ?? null,
    action: decision?.action ?? null,
    confidence: decision?.confidence ?? null,
    rationale: decision?.rationale ?? null,
    steps: recorder.steps,
    metrics: {
      ...emptyMetrics(),
      model: MODEL_ID,
      ...usage,
      costUsd: estimateCostUsd(MODEL_ID, usage),
      latencyMs: Date.now() - startedAt,
      firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
    },
  };

  const finalText =
    text.trim() ||
    (recorder.blocks.length > 0 ? "" : "Desculpe, não consegui concluir agora. Pode me contar de outro jeito?");
  addMessage(
    db,
    { conversationId: conversation.id, role: "assistant", text: finalText, blocks: recorder.blocks, trace },
    now,
  );
  logger.info("agent.turn_completed", {
    conversationId: conversation.id,
    intent: trace.intent,
    confidence: trace.confidence,
    tools: trace.steps.map((s) => s.tool),
    ...usage,
    latencyMs: trace.metrics.latencyMs,
  });

  if (recorder.handoff) {
    transferConversation(db, conversation.id, recorder.handoff, now);
    return;
  }
  escalateIfUnsure(turn, conversation.id);
}

/** Regra de baixa segurança: duas respostas seguidas com confiança baixa → analista. */
function escalateIfUnsure(turn: TurnContext, conversationId: string): void {
  // Só conta o que veio depois do último evento de sistema (ex.: analista devolveu a conversa).
  const history = listMessages(turn.db, conversationId);
  const lastSystem = history.findLastIndex((m) => m.role === "system");
  const answers = history.slice(lastSystem + 1).filter((m) => m.role === "assistant" && m.trace?.source === "agent");
  if (!shouldEscalateForLowConfidence(answers.map((m) => m.confidence))) return;

  const last = answers.at(-1)?.trace;
  const handoff = buildHandoff({
    reason: "baixa_confianca",
    summary: `O agent não teve segurança para decidir em duas respostas seguidas. Último entendimento: ${last?.understood ?? "não registrado"}`,
    ticketNumber: null,
    ticketPriority: null,
    confidence: last?.confidence ?? null,
    now: turn.now,
  });
  addMessage(
    turn.db,
    {
      conversationId,
      role: "assistant",
      text: `Para não te deixar sem resposta, chamei um analista do Suporte ${handoff.level}. Ele já recebe o resumo da conversa e continua por aqui.`,
      trace: {
        source: "server",
        intent: "transferencia",
        understood: last?.understood ?? null,
        action: "Transferir para um analista",
        confidence: 1,
        rationale:
          "Regra do service desk: quando o agent não tem segurança sobre o que fazer, a conversa vai para um analista.",
        steps: [],
        metrics: emptyMetrics(),
      },
    },
    turn.now,
  );
  transferConversation(turn.db, conversationId, handoff, turn.now);
}
