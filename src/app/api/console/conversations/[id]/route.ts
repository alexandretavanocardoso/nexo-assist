import { NextResponse } from "next/server";
import { z } from "zod";
import { InvalidTransitionError } from "@/domain/conversation-state";
import {
  assumeConversation,
  closeConversation,
  ConsoleActionError,
  releaseConversation,
  sendAnalystMessage,
} from "@/server/console/console-service";
import { getDb } from "@/server/db/client";
import { HttpError, parseBody, requireUser, route } from "@/server/http";
import {
  ConversationNotFoundError,
  getConversation,
  toConversationView,
} from "@/services/conversations/conversation-service";
import { getTicketService } from "@/services/tickets";
import { withRetry } from "@/services/tickets/retry";
import { toTicketView } from "@/services/tickets/view";

type Context = { params: Promise<{ id: string }> };

function loadConversation(id: string) {
  try {
    return getConversation(getDb(), id);
  } catch (error) {
    if (error instanceof ConversationNotFoundError) throw new HttpError(404, "not_found", error.message);
    throw error;
  }
}

/** Histórico da conversa + painel com os chamados do funcionário. */
export const GET = route(async (_request: Request, { params }: Context) => {
  const analyst = await requireUser("analyst");
  const conversation = loadConversation((await params).id);
  const now = new Date();
  const result = await withRetry(() =>
    getTicketService().listForEmployee({ id: analyst.id, role: "analyst" }, conversation.employeeId),
  );
  return NextResponse.json({
    conversation: toConversationView(getDb(), conversation),
    tickets: result.ok ? result.value.map(({ ticket, events }) => toTicketView(ticket, now, events)) : null,
    ticketsError: result.ok ? null : "Sistema de chamados indisponível no momento.",
  });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assume") }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("message"), text: z.string().trim().min(1).max(2000) }),
]);

/** Ações do analista: assumir, devolver ao agent, encerrar e responder. */
export const POST = route(async (request: Request, { params }: Context) => {
  const analyst = await requireUser("analyst");
  const { id } = await params;
  loadConversation(id);
  const body = await parseBody(request, actionSchema);
  const db = getDb();
  const now = new Date();
  try {
    if (body.action === "assume") await assumeConversation(db, getTicketService(), analyst, id, now);
    if (body.action === "release") releaseConversation(db, analyst, id, now);
    if (body.action === "close") closeConversation(db, analyst, id, now);
    if (body.action === "message") sendAnalystMessage(db, analyst, id, body.text, now);
  } catch (error) {
    if (error instanceof InvalidTransitionError || error instanceof ConsoleActionError) {
      throw new HttpError(409, "invalid_state", error instanceof ConsoleActionError ? error.message : "A conversa mudou de estado. Atualize a tela.");
    }
    throw error;
  }
  return NextResponse.json({ conversation: toConversationView(db, getConversation(db, id)) });
});
