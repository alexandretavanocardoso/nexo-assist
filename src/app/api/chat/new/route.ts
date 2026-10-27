import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { requireUser, route } from "@/server/http";
import { startNewConversation, toConversationView } from "@/services/conversations/conversation-service";

/** Encerra a conversa atual e começa uma nova (ex.: depois do limite de 30 mensagens). */
export const POST = route(async () => {
  const employee = await requireUser("employee");
  const db = getDb();
  const conversation = startNewConversation(db, employee.id, new Date());
  return NextResponse.json({ conversation: toConversationView(db, conversation) });
});
