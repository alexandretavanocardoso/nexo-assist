import type { Db } from "@/server/db/client";
import { addMessage, setHandoff } from "@/services/conversations/conversation-service";
import type { Handoff } from "@/services/conversations/types";

/** Passa a conversa para "aguardando atendente" e registra a linha de sistema no histórico. */
export function transferConversation(db: Db, conversationId: string, handoff: Handoff, now: Date): void {
  setHandoff(db, conversationId, handoff, now);
  addMessage(db, { conversationId, role: "system", text: `Transferida para Suporte ${handoff.level}` }, now);
}
