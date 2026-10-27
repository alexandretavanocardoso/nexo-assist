"use client";

import { Bot, CheckCheck, CircleCheckBig, Hand, Headset, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DecisionPanel } from "@/components/chat/decision-panel";
import { RichText, SystemLine } from "@/components/chat/chat-messages";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/status";
import { formatDue, formatLocalTime } from "@/domain/business-hours";
import { HANDOFF_REASON_LABELS, type ChatMessage, type ConversationView } from "@/services/conversations/types";

export type PaneAction = "assume" | "release" | "close";

export function ConversationPane({
  conversation,
  analystId,
  busy,
  error,
  onAction,
  onSend,
}: {
  conversation: ConversationView;
  analystId: string;
  busy: boolean;
  error: string | null;
  onAction: (action: PaneAction) => void;
  onSend: (text: string) => Promise<boolean>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mine = conversation.status === "human" && conversation.assignedAnalyst?.id === analystId;
  const firstName = conversation.employee.name.split(" ")[0];
  const lastTransfer = conversation.messages.findLastIndex(
    (m) => m.role === "system" && m.text.startsWith("Transferida"),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation.messages.length]);

  return (
    <section className="bg-canvas flex min-w-0 flex-1 flex-col">
      <header className="border-rule bg-paper flex h-16 shrink-0 items-center gap-3 border-b pr-4 pl-5">
        <Avatar name={conversation.employee.name} size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ink truncate text-[15.5px] font-semibold">{conversation.employee.name}</span>
          <span className="text-ink-3 truncate text-[12.5px]">
            {conversation.employee.department}
            {conversation.handoff?.ticketNumber && ` · ${conversation.handoff.ticketNumber}`}
          </span>
        </div>
        {conversation.status === "waiting_human" && (
          <span className="bg-warning-soft text-warning-text flex items-center gap-[7px] rounded-full px-[11px] py-1.5 text-[12.5px] font-semibold">
            <Bot size={14} /> Aguardando atendente
          </span>
        )}
        {conversation.status === "human" && (
          <>
            <button
              disabled={busy}
              onClick={() => onAction("release")}
              className="border-line text-ink-2 hover:bg-desk flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13.5px] font-medium disabled:opacity-60"
            >
              <Bot size={15} /> Devolver ao agent
            </button>
            <button
              disabled={busy}
              onClick={() => onAction("close")}
              className="bg-danger-soft text-danger-text hover:bg-danger/15 flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold disabled:opacity-60"
            >
              <CircleCheckBig size={15} /> Encerrar atendimento
            </button>
          </>
        )}
        {conversation.status === "agent" && (
          <span className="bg-success-soft text-success-text flex items-center gap-[7px] rounded-full px-[11px] py-1.5 text-[12.5px] font-semibold">
            <Bot size={14} /> Agent atendendo
          </span>
        )}
        {conversation.status === "closed" && (
          <span className="bg-desk text-ink-3 rounded-full px-[11px] py-1.5 text-[12.5px] font-semibold">
            Encerrada
          </span>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 scrollbar-thin overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end gap-4 px-10 pt-5 pb-4 max-lg:px-5">
          {conversation.messages.map((message, index) => (
            <div key={message.id} className="flex flex-col gap-3">
              <ConsoleMessage message={message} />
              {index === lastTransfer && conversation.handoff && <HandoffCard conversation={conversation} />}
            </div>
          ))}
        </div>
      </div>

      <footer className="border-rule bg-paper flex flex-col gap-2.5 border-t px-5 pt-3 pb-3.5">
        {error && <p className="bg-danger-soft text-danger-text rounded-lg px-3 py-2 text-[13px]">{error}</p>}
        {conversation.status === "waiting_human" && (
          <>
            <div className="flex items-center gap-3">
              <span className="bg-warning-soft text-warning-text flex size-9 items-center justify-center rounded-full">
                <Hand size={16} />
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-ink text-[14.5px] font-semibold">{firstName} espera um atendente</span>
                <span className="text-ink-3 text-[12.5px]">
                  Agent pausado
                  {conversation.handoff &&
                    ` · contato até ${formatDue(new Date(conversation.handoff.contactDueAt), new Date())}`}
                </span>
              </div>
              <button
                disabled={busy}
                onClick={() => onAction("release")}
                className="border-line text-ink-2 hover:bg-desk flex h-9 items-center gap-[7px] rounded-lg border pr-3.5 pl-3 text-[13.5px] font-medium disabled:opacity-60"
              >
                <Bot size={15} /> Devolver ao agent
              </button>
              <button
                disabled={busy}
                onClick={() => onAction("assume")}
                className="bg-cta hover:bg-cta-hover flex h-9 items-center gap-[7px] rounded-lg pr-4 pl-3.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
              >
                <Headset size={15} /> Assumir atendimento
              </button>
            </div>
            <div className="bg-desk text-ink-3 flex h-11 items-center rounded-xl px-3.5 text-[14.5px] opacity-55">
              Assuma o atendimento para responder
            </div>
          </>
        )}
        {conversation.status === "human" && mine && <AnalystComposer busy={busy} onSend={onSend} />}
        {conversation.status === "human" && !mine && (
          <p className="text-ink-3 text-[13px]">
            {conversation.assignedAnalyst?.name ?? "Outro analista"} está atendendo esta conversa.
          </p>
        )}
        {conversation.status === "agent" && (
          <p className="text-ink-3 text-[13px]">
            O Nexo Assist está atendendo. Se ele transferir, a conversa aparece em “Para você”.
          </p>
        )}
        {conversation.status === "closed" && <p className="text-ink-3 text-[13px]">Atendimento encerrado.</p>}
      </footer>
    </section>
  );
}

function ConsoleMessage({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);
  const time = formatLocalTime(new Date(message.createdAt));

  if (message.role === "system") return <SystemLine text={message.text} at={message.createdAt} />;

  if (message.role === "user") {
    return (
      <div className="flex">
        <div className="bg-paper text-ink flex max-w-[70%] items-end gap-2.5 rounded-[4px_12px_12px_12px] px-3 pt-2 pb-1.5 text-[14.5px]">
          <RichText text={message.text} />
          <span className="text-ink-3 shrink-0 text-[11px]">{time}</span>
        </div>
      </div>
    );
  }

  const isAgent = message.role === "assistant";
  return (
    <div className="flex flex-col items-end gap-1">
      <p className="flex items-center gap-1.5 px-1 text-[12px]">
        <span className="text-ink-2 font-semibold">
          {message.author?.name ?? (isAgent ? "Nexo Assist" : "Analista")}
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 text-[11px] font-semibold",
            isAgent ? "bg-primary-soft text-primary-text" : "bg-success-soft text-success-text",
          )}
        >
          {message.author?.label ?? (isAgent ? "IA" : "Analista")}
        </span>
        {isAgent && message.trace && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-primary-text hover:bg-primary-soft rounded px-1 font-medium"
          >
            {expanded ? "ocultar decisão" : "ver decisão"}
          </button>
        )}
      </p>
      <div
        className={cn(
          "text-ink flex max-w-[70%] flex-col gap-0.5 rounded-[12px_4px_12px_12px] px-3 pt-2 pb-1.5 text-[14.5px]",
          isAgent ? "bg-agent-bubble" : "bg-analyst-bubble",
        )}
      >
        {message.text ? <RichText text={message.text} /> : <span className="text-ink-3">(mostrou um cartão)</span>}
        <span className="text-ink-3 flex items-center justify-end gap-[3px] text-[11px]">
          {time}
          <CheckCheck size={14} className="text-primary" />
        </span>
      </div>
      {expanded && message.trace && (
        <div className="w-full max-w-[640px]">
          <DecisionPanel trace={message.trace} />
        </div>
      )}
    </div>
  );
}

function HandoffCard({ conversation }: { conversation: ConversationView }) {
  const handoff = conversation.handoff;
  if (!handoff) return null;
  return (
    <div className="border-warning/30 bg-paper mx-auto w-full max-w-[640px] rounded-xl border p-4 text-[13.5px]">
      <p className="mb-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-warning-text font-semibold">Resumo da transferência</span>
        <span className="bg-warning-soft text-warning-text rounded-md px-1.5 font-medium">
          {HANDOFF_REASON_LABELS[handoff.reason]}
        </span>
        <span className="text-ink-3">
          Suporte {handoff.level} · prioridade {handoff.priority.toLowerCase()}
          {handoff.confidence !== null && ` · confiança do agent ${Math.round(handoff.confidence * 100)}%`}
        </span>
      </p>
      <p className="text-ink">{handoff.summary}</p>
    </div>
  );
}

function AnalystComposer({ busy, onSend }: { busy: boolean; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (await onSend(value)) setText("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva sua resposta…"
        maxLength={2000}
        className="bg-desk text-ink focus:ring-cta/30 h-11 flex-1 rounded-xl px-3.5 text-[14.5px] outline-none focus:ring-2"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        aria-label="Enviar"
        className="bg-cta hover:bg-cta-hover flex size-11 items-center justify-center rounded-full text-white disabled:opacity-50"
      >
        <SendHorizontal size={18} />
      </button>
    </form>
  );
}
