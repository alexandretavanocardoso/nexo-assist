import { redirect } from "next/navigation";
import { ChatApp } from "@/components/chat/chat-app";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getOrCreateActiveConversation, toConversationView } from "@/services/conversations/conversation-service";

export default async function AtendimentoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Retoma a conversa em andamento (mesmo que tenha começado em outro dia).
  const db = getDb();
  const conversation = toConversationView(db, getOrCreateActiveConversation(db, user.id, new Date()));
  return <ChatApp initialConversation={conversation} />;
}
