import { NextResponse } from "next/server";
import { z } from "zod";
import { getNexoAgent } from "@/agent/nexo-agent";
import { handleEmployeeTurn, type ChatInput } from "@/server/chat/handle-turn";
import { getDb } from "@/server/db/client";
import { HttpError, parseBody, requireUser, route } from "@/server/http";
import { allowRequest } from "@/server/rate-limit";
import { sseResponse } from "@/server/sse";
import { getOrCreateActiveConversation, toConversationView } from "@/services/conversations/conversation-service";
import { getTicketService } from "@/services/tickets";

/** Conversa em andamento do funcionário (retomada em outro dia, inclusive). */
export const GET = route(async () => {
  const employee = await requireUser("employee");
  const db = getDb();
  const conversation = getOrCreateActiveConversation(db, employee.id, new Date());
  return NextResponse.json({ conversation: toConversationView(db, conversation) });
});

const chatSchema = z.union([
  z.object({ text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.enum(["confirm", "cancel"]), draftId: z.string().min(1) }),
  z.object({ retry: z.literal(true) }),
]);

function toChatInput(body: z.infer<typeof chatSchema>): ChatInput {
  if ("text" in body) return { kind: "message", text: body.text };
  if ("action" in body) return { kind: body.action === "confirm" ? "confirm-draft" : "cancel-draft", draftId: body.draftId };
  return { kind: "retry" };
}

/** Envia uma mensagem (ou ação do rascunho) e devolve a resposta em streaming (SSE). */
export const POST = route(async (request: Request) => {
  const employee = await requireUser("employee");
  const input = toChatInput(await parseBody(request, chatSchema));
  if (input.kind !== "confirm-draft" && input.kind !== "cancel-draft" && !allowRequest(employee.id)) {
    throw new HttpError(429, "rate_limited", "Muitas mensagens em pouco tempo. Espere alguns segundos e tente de novo.");
  }
  const deps = { db: getDb(), tickets: getTicketService(), getAgent: getNexoAgent };
  return sseResponse((emit) => handleEmployeeTurn(deps, employee, input, emit));
});
