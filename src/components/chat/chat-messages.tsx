"use client";

import { ArrowRightLeft, Headset } from "lucide-react";
import { Fragment, useState } from "react";
import { actionLabelsOf } from "@/agent/trace";
import { formatLocalTime } from "@/domain/business-hours";
import { cn } from "@/components/ui/status";
import type { ChatMessage, UiBlock } from "@/services/conversations/types";
import { ActionLine, type ActionChip } from "./action-line";
import { Block, type BlockActions } from "./blocks";
import { DecisionPanel } from "./decision-panel";
import type { PendingAnswer } from "./use-chat";

/** Texto simples com quebras de linha e **negrito** (o agent é orientado a não usar markdown). */
export function RichText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line">
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
    </p>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-ink max-w-[520px] rounded-[12px_12px_4px_12px] px-4 py-[11px] text-[14.5px] text-white">
        <RichText text={text} />
      </div>
    </div>
  );
}

export function SystemLine({ text, at }: { text: string; at?: string }) {
  const Icon = /assumiu/.test(text) ? Headset : ArrowRightLeft;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="bg-ink/10 h-px flex-1" />
      <span className="text-ink-3 flex items-center gap-1.5 text-[12px] font-medium">
        <Icon size={13} />
        {text}
        {at && ` · ${formatLocalTime(new Date(at))}`}
      </span>
      <span className="bg-ink/10 h-px flex-1" />
    </div>
  );
}

function splitBlocks(blocks: UiBlock[]) {
  return {
    cards: blocks.filter((b) => b.type !== "quick-replies" && b.type !== "articles"),
    footer: blocks.filter((b) => b.type === "quick-replies" || b.type === "articles"),
  };
}

export function AgentMessage({
  message,
  pending,
  actions,
}: {
  message?: ChatMessage;
  pending?: PendingAnswer;
  actions: BlockActions;
}) {
  const [expanded, setExpanded] = useState(false);
  const trace = message?.trace ?? null;
  const text = message?.text ?? pending?.text ?? "";
  const blocks = message?.blocks ?? pending?.blocks ?? [];
  const chips: ActionChip[] = trace
    ? actionLabelsOf(trace).map((label) => ({ label, status: "done" }))
    : (pending?.steps ?? []).flatMap((step) => step.labels.map((label) => ({ label, status: step.status })));
  const { cards, footer } = splitBlocks(blocks);
  const thinking = pending && !text && blocks.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <ActionLine
        chips={chips}
        canExpand={trace !== null}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && trace && <DecisionPanel trace={trace} />}
      {pending?.notice && (
        <p className="bg-warning-soft text-warning-text w-fit rounded-lg px-3 py-1.5 text-[13px]">{pending.notice}</p>
      )}
      {(text || thinking) && (
        <div className="border-rule bg-paper text-ink max-w-[600px] rounded-[4px_12px_12px_12px] border px-4 py-3 text-[14.5px]">
          {thinking ? <TypingDots /> : <RichText text={text} />}
        </div>
      )}
      {cards.map((block, i) => (
        <Block key={`${block.type}-${i}`} block={block} actions={actions} />
      ))}
      {footer.map((block, i) => (
        <Block key={`${block.type}-f${i}`} block={block} actions={actions} />
      ))}
    </div>
  );
}

export function AnalystMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[12.5px]">
        <span className="text-ink font-semibold">{message.author?.name ?? "Analista"}</span>
        {message.author?.label && (
          <span className="bg-success-soft text-success-text rounded-md px-1.5 text-[11px] font-semibold">
            {message.author.label}
          </span>
        )}
      </p>
      <div className="bg-analyst-bubble text-ink max-w-[600px] rounded-[4px_12px_12px_12px] px-4 py-3 text-[14.5px]">
        <RichText text={message.text} />
      </div>
    </div>
  );
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 py-1", className)} aria-label="Nexo Assist está respondendo">
      <span className="typing-dot bg-ink-3 size-1.5 rounded-full" />
      <span className="typing-dot bg-ink-3 size-1.5 rounded-full" />
      <span className="typing-dot bg-ink-3 size-1.5 rounded-full" />
    </span>
  );
}
