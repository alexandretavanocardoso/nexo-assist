"use client";

import { Hand, Headset, MessageSquarePlus, RotateCw, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { TopBar } from "@/components/employee/top-bar";
import { formatDue } from "@/domain/business-hours";
import { cn } from "@/components/ui/status";
import type { ConversationView } from "@/services/conversations/types";
import type { BlockActions } from "./blocks";
import { AgentMessage, AnalystMessage, SystemLine, UserBubble } from "./chat-messages";
import { Composer } from "./composer";
import { useChat } from "./use-chat";

const SUGGESTIONS = [
  "Minha VPN não conecta, dá erro 809",
  "Como está meu chamado do notebook?",
  "Qual o horário do service desk?",
  "Quero falar com um analista",
];

export function ChatApp({ initialConversation }: { initialConversation: ConversationView }) {
  const chat = useChat(initialConversation);
  const { conversation, pending, busy } = chat;
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastAssistant = useMemo(() => conversation.messages.findLast((m) => m.role === "assistant"), [conversation]);
  const lastIsAssistant = conversation.messages.at(-1)?.id === lastAssistant?.id;
  const pendingDraft = lastAssistant?.blocks.find((b) => b.type === "draft" && b.draft.status === "pending");
  const quickReplies = lastAssistant?.blocks.find((b) => b.type === "quick-replies");
  const limitReached = conversation.userMessageCount >= conversation.messageLimit;
  const withAgent = conversation.status === "agent";

  // Rola para o fim quando chega conteúdo novo.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.messages.length, pending?.text, pending?.blocks.length, pending?.steps.length]);

  // Ctrl/⌘ + Enter confirma o rascunho pendente.
  useEffect(() => {
    if (pendingDraft?.type !== "draft") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !busy) {
        event.preventDefault();
        void chat.confirmDraft(pendingDraft.draft.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDraft, busy, chat]);

  const actionsFor = (interactive: boolean, answer?: string): BlockActions => ({
    interactive: interactive && withAgent,
    busy,
    answer,
    onSend: (text) => void chat.send(text),
    onConfirm: (id) => void chat.confirmDraft(id),
    onCancel: (id) => void chat.cancelDraft(id),
    onEdit: () => {
      const input = composerRef.current;
      if (!input) return;
      input.focus();
      input.placeholder = "O que você quer mudar no rascunho?";
    },
  });

  const handoff = conversation.handoff;
  const placeholder = !withAgent
    ? "Escreva para o analista…"
    : limitReached
      ? "Limite de mensagens atingido"
      : "Escreva para o Nexo…";

  return (
    <Shell
      conversation={conversation}
      onNewConversation={withAgent && conversation.messages.length > 0 ? chat.startNewConversation : undefined}
    >
      <div ref={scrollRef} className="flex-1 scrollbar-thin overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col justify-end gap-5 px-6 pt-7 pb-1 lg:px-[120px] xl:px-[200px]">
          {conversation.messages.length === 0 && !pending && (
            <Welcome
              firstName={conversation.employee.name.split(" ")[0] ?? ""}
              onPick={(text) => void chat.send(text)}
            />
          )}
          {conversation.messages.map((message, index) => {
            if (message.role === "user") return <UserBubble key={message.id} text={message.text} />;
            if (message.role === "system")
              return <SystemLine key={message.id} text={message.text} at={message.createdAt} />;
            if (message.role === "analyst") return <AnalystMessage key={message.id} message={message} />;
            const interactive = message.id === lastAssistant?.id && lastIsAssistant && !pending;
            const next = conversation.messages[index + 1];
            const answer = next?.role === "user" ? next.text : undefined;
            return <AgentMessage key={message.id} message={message} actions={actionsFor(interactive, answer)} />;
          })}
          {pending && withAgent && <AgentMessage pending={pending} actions={actionsFor(false)} />}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-2 px-6 pt-2.5 pb-[18px] lg:px-[120px] xl:px-[200px]">
        {!withAgent && handoff && (
          <p className="bg-warning-soft text-warning-text flex items-start gap-2 rounded-lg px-3 py-2 text-[13px]">
            {conversation.status === "human" ? (
              <Headset size={15} className="mt-0.5 shrink-0" />
            ) : (
              <Hand size={15} className="mt-0.5 shrink-0" />
            )}
            {conversation.status === "human"
              ? `${conversation.assignedAnalyst?.name ?? "Um analista"} está atendendo você. O assistente está pausado.`
              : `Transferida para o Suporte ${handoff.level}. Um analista fala com você por aqui até ${formatDue(new Date(handoff.contactDueAt), new Date())}. O assistente está pausado.`}
          </p>
        )}
        {chat.info && conversation.messages.length === 0 && (
          <p className="bg-desk text-ink-2 rounded-lg px-3 py-2 text-[13px]">{chat.info}</p>
        )}
        {chat.loadError && (
          <p className="bg-desk text-ink-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]">
            <RotateCw size={13} className="animate-spin" /> Sem conexão com o servidor. Tentando de novo…
          </p>
        )}
        {chat.error && (
          <div
            role="alert"
            className="bg-danger-soft text-danger-text flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]"
          >
            <span className="flex-1">{chat.error.message}</span>
            {chat.error.retryable && (
              <button
                onClick={() => void chat.retry()}
                className="flex items-center gap-1 font-semibold hover:underline"
              >
                <RotateCw size={13} /> Tentar novamente
              </button>
            )}
            <button onClick={chat.dismissError} aria-label="Fechar aviso">
              <X size={14} />
            </button>
          </div>
        )}
        {limitReached && withAgent && (
          <div className="bg-desk text-ink-2 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px]">
            <span className="flex-1">Você chegou ao limite de {conversation.messageLimit} mensagens desta sessão.</span>
            <button onClick={() => void chat.startNewConversation()} className="text-cta font-semibold hover:underline">
              Começar nova conversa
            </button>
          </div>
        )}
        <Composer
          ref={composerRef}
          disabled={withAgent ? limitReached : false}
          busy={busy}
          placeholder={placeholder}
          counter={
            withAgent ? `${conversation.userMessageCount}/${conversation.messageLimit} mensagens nesta sessão` : null
          }
          onSend={(text) => void chat.send(text)}
          onShortcut={(key) => {
            const option =
              quickReplies?.type === "quick-replies" && lastIsAssistant
                ? quickReplies.options[Number(key) - 1]
                : undefined;
            if (option && !busy) void chat.send(option);
            return Boolean(option);
          }}
        />
      </div>
    </Shell>
  );
}

function Shell({
  conversation,
  onNewConversation,
  children,
}: {
  conversation: ConversationView;
  onNewConversation?: () => void;
  children: React.ReactNode;
}) {
  const pill =
    conversation.status === "agent"
      ? { text: "Assistente online", className: "bg-success-soft text-success-text", dot: "bg-success" }
      : conversation.status === "human"
        ? {
            text: `${conversation.assignedAnalyst?.name ?? "Analista"} atendendo`,
            className: "bg-success-soft text-success-text",
            dot: "bg-success",
          }
        : { text: "Aguardando atendente", className: "bg-warning-soft text-warning-text", dot: "bg-warning" };

  return (
    <>
      <TopBar here="Atendimento">
        {onNewConversation && (
          <button
            onClick={onNewConversation}
            className="text-ink-2 hover:bg-desk hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium sm:flex"
            title="Encerra esta conversa e começa outra"
          >
            <MessageSquarePlus size={15} /> Nova conversa
          </button>
        )}
        <span
          className={cn(
            "flex items-center gap-[7px] rounded-full px-2.5 py-[5px] text-[12.5px] font-semibold",
            pill.className,
          )}
        >
          <span className={cn("size-[7px] rounded-full", pill.dot)} />
          {pill.text}
        </span>
      </TopBar>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </>
  );
}

function Welcome({ firstName, onPick }: { firstName: string; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-ink text-[12.5px] font-semibold">Nexo Assist</p>
      <div className="border-rule bg-paper text-ink max-w-[600px] rounded-[4px_12px_12px_12px] border px-4 py-3 text-[14.5px]">
        Olá, {firstName}! Sou o assistente do service desk de TI. Conte com suas palavras o que está acontecendo: eu
        consulto seus chamados, busco na central de ajuda e chamo um analista quando precisar.
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            onClick={() => onPick(text)}
            className="border-rule bg-paper text-ink hover:border-primary hover:bg-primary-soft hover:text-primary-text rounded-lg border px-3 py-[7px] text-[13.5px] font-medium"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
