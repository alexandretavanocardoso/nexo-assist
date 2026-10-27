"use client";

// Estado do chat do funcionário: carrega a conversa, envia mensagens/ações e acompanha
// o streaming (passos do agent, texto, cartões). Quando a conversa está com um analista,
// busca novidades a cada poucos segundos.
import { useCallback, useEffect, useRef, useState } from "react";
import { postStream, RequestError, requestJson } from "@/lib/sse-client";
import type { StepEvent, StreamEvent } from "@/lib/stream-events";
import type { ConversationView, UiBlock } from "@/services/conversations/types";

export type PendingAnswer = { steps: StepEvent[]; text: string; blocks: UiBlock[]; notice: string | null };
export type ChatErrorState = { message: string; retryable: boolean; code: string };

const POLL_MS = 4000;

export function useChat(initialConversation: ConversationView) {
  const [conversation, setConversation] = useState<ConversationView>(initialConversation);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAnswer | null>(null);
  const [error, setError] = useState<ChatErrorState | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ conversation: ConversationView }>("/api/chat");
      setConversation(data.conversation);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar a conversa.");
    }
  }, []);

  // Com um analista, as respostas chegam por fora do streaming: busca periodicamente.
  const waitingHuman = conversation.status !== "agent";
  useEffect(() => {
    if (!waitingHuman) return;
    const timer = setInterval(() => {
      if (!busyRef.current) void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waitingHuman, load]);

  const handleEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case "user-message":
        setConversation((c) => ({
          ...c,
          messages: [...c.messages, event.message],
          userMessageCount: c.userMessageCount + 1,
        }));
        break;
      case "step":
        setPending(
          (p) =>
            p && {
              ...p,
              steps: p.steps.some((s) => s.id === event.step.id)
                ? p.steps.map((s) => (s.id === event.step.id ? event.step : s))
                : [...p.steps, event.step],
            },
        );
        break;
      case "notice":
        setPending((p) => p && { ...p, notice: event.text });
        break;
      case "text-delta":
        setPending((p) => p && { ...p, text: p.text + event.text, notice: null });
        break;
      case "block":
        setPending(
          (p) =>
            p && {
              ...p,
              blocks: [...p.blocks.filter((b) => b.type !== event.block.type || b.type === "ticket-card"), event.block],
            },
        );
        break;
      case "error":
        setError({ message: event.message, retryable: event.retryable, code: event.code });
        break;
      case "done":
        setConversation(event.conversation);
        setPending(null);
        break;
    }
  }, []);

  const run = useCallback(
    async (body: unknown) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      setPending({ steps: [], text: "", blocks: [], notice: null });
      try {
        await postStream("/api/chat", body, handleEvent);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : "Falha de conexão.",
          retryable: !(err instanceof RequestError) || err.status >= 500,
          code: err instanceof RequestError ? String(err.status) : "network",
        });
        void load();
      } finally {
        setPending(null);
        busyRef.current = false;
        setBusy(false);
      }
    },
    [handleEvent, load],
  );

  const startNewConversation = useCallback(async () => {
    setError(null);
    try {
      const data = await requestJson<{ conversation: ConversationView }>("/api/chat/new", { method: "POST" });
      setConversation(data.conversation);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Falha ao iniciar conversa.",
        retryable: false,
        code: "new",
      });
    }
  }, []);

  return {
    conversation,
    loadError,
    pending,
    error,
    busy,
    reload: load,
    dismissError: () => setError(null),
    send: (text: string) => run({ text }),
    confirmDraft: (draftId: string) => run({ action: "confirm", draftId }),
    cancelDraft: (draftId: string) => run({ action: "cancel", draftId }),
    retry: () => run({ retry: true }),
    startNewConversation,
  };
}
