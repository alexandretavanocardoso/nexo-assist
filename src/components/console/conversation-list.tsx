"use client";

import { CheckCheck, Search } from "lucide-react";
import { formatDue, formatLocalDate, formatLocalTime } from "@/domain/business-hours";
import { Avatar } from "@/components/ui/avatar";
import { cn, Dot } from "@/components/ui/status";
import type { ConsoleFilter, ConsoleList, ConsoleListItem } from "@/server/console/console-service";

const FILTERS: Array<{ id: ConsoleFilter; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "para_voce", label: "Para você" },
  { id: "com_agent", label: "Com o agent" },
  { id: "minhas", label: "Minhas" },
];

export function ConversationList({
  list,
  filter,
  query,
  selectedId,
  analystId,
  onFilter,
  onQuery,
  onSelect,
}: {
  list: ConsoleList | null;
  filter: ConsoleFilter;
  query: string;
  selectedId: string | null;
  analystId: string;
  onFilter: (filter: ConsoleFilter) => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="border-rule flex w-[380px] shrink-0 flex-col border-r max-lg:w-[320px]">
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2.5">
        <div className="flex items-center gap-2">
          <h1 className="text-ink flex-1 text-xl font-bold">Conversas</h1>
          <span className="bg-success-soft text-success-text flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[12.5px] font-semibold">
            <Dot className="bg-success" size={7} /> Disponível
          </span>
        </div>
        <label className="bg-desk flex h-9 items-center gap-2.5 rounded-full px-3">
          <Search size={16} className="text-ink-3" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Pesquisar conversa ou chamado"
            className="text-ink placeholder:text-ink-3 w-full bg-transparent text-[13.5px] outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id;
            const count = list?.counts[id];
            return (
              <button
                key={id}
                onClick={() => onFilter(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-[9px] py-1.5 text-[12.5px] font-medium",
                  active ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-rule",
                )}
              >
                {label}
                {id !== "todas" && count !== undefined && (
                  <span className={cn("font-semibold", active ? "text-primary-text" : "text-ink-3")}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 scrollbar-thin flex-col overflow-y-auto px-2 pb-2">
        {!list && <ListSkeleton />}
        {list && list.items.length === 0 && (
          <p className="text-ink-3 px-3 py-8 text-center text-[13.5px]">Nenhuma conversa neste filtro.</p>
        )}
        {list?.items.map((item) => (
          <ConversationItem
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            analystId={analystId}
            onSelect={() => onSelect(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ConversationItem({
  item,
  selected,
  analystId,
  onSelect,
}: {
  item: ConsoleListItem;
  selected: boolean;
  analystId: string;
  onSelect: () => void;
}) {
  const tag = tagFor(item, analystId);
  const needsHuman = item.status === "waiting_human";
  const last = item.lastMessage;
  return (
    <button
      onClick={onSelect}
      className={cn("flex w-full gap-3 rounded-xl p-2.5 text-left", selected ? "bg-desk" : "hover:bg-desk/60")}
    >
      <Avatar name={item.employee.name} online={item.online} ring={selected ? "#F6F7F9" : "#FFFFFF"} />
      <span className="border-rule flex min-w-0 flex-1 flex-col gap-[3px] border-b pb-2.5">
        <span className="flex items-center gap-2">
          <span className={cn("text-ink flex-1 truncate text-[15.5px]", needsHuman ? "font-semibold" : "font-medium")}>
            {item.employee.name}
          </span>
          <span className={cn("text-[12.5px]", item.unread > 0 ? "text-cta font-semibold" : "text-ink-3")}>
            {last ? timeLabel(last.at) : ""}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          {last?.role === "assistant" && <CheckCheck size={15} className="text-primary shrink-0" />}
          <span className="text-ink-3 flex-1 truncate text-[13.5px]">
            {last
              ? `${last.role === "assistant" ? "Nexo: " : last.role === "analyst" ? "Analista: " : ""}${last.text}`
              : "Sem mensagens"}
          </span>
          {item.unread > 0 && (
            <span className="bg-cta flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11.5px] font-bold text-white">
              {item.unread}
            </span>
          )}
        </span>
        <span className={cn("flex items-center gap-[5px] text-[11.5px] font-medium", tag.text)}>
          <Dot className={tag.dot} />
          {tag.label}
        </span>
      </span>
    </button>
  );
}

function tagFor(item: ConsoleListItem, analystId: string): { label: string; dot: string; text: string } {
  const handoff = item.handoff;
  switch (item.status) {
    case "waiting_human":
      if (handoff?.reason === "baixa_confianca") {
        const confidence = handoff.confidence !== null ? ` · confiança ${Math.round(handoff.confidence * 100)}%` : "";
        return { label: `Agent pediu ajuda${confidence}`, dot: "bg-warning", text: "text-warning-text" };
      }
      return {
        label: handoff?.ticketNumber
          ? `Transferida · ${handoff.ticketNumber}`
          : `Transferida · contato até ${handoff ? formatDue(new Date(handoff.contactDueAt), new Date()) : "—"}`,
        dot: "bg-danger",
        text: "text-danger-text",
      };
    case "human":
      return item.assignedAnalyst?.id === analystId
        ? { label: "Você está atendendo", dot: "bg-success", text: "text-success-text" }
        : { label: `${item.assignedAnalyst?.name ?? "Analista"} atendendo`, dot: "bg-success", text: "text-ink-3" };
    case "agent":
      return { label: "Agent atendendo", dot: "bg-success", text: "text-ink-3" };
    case "closed":
      return {
        label: item.closedReason === "resolvida_pelo_agent" ? "Resolvida pelo agent" : "Encerrada",
        dot: "bg-ink/30",
        text: "text-ink-3",
      };
  }
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (now.getTime() - date.getTime() < 60_000) return "agora";
  if (formatLocalDate(date) === formatLocalDate(now)) return formatLocalTime(date);
  if (formatLocalDate(date) === formatLocalDate(new Date(now.getTime() - 86_400_000))) return "ontem";
  return formatLocalDate(date);
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-2.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <span className="bg-desk size-[46px] animate-pulse rounded-full" />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className="bg-desk h-3 w-1/2 animate-pulse rounded" />
            <span className="bg-desk h-3 w-3/4 animate-pulse rounded" />
          </span>
        </div>
      ))}
    </div>
  );
}
