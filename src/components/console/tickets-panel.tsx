"use client";

import { ArrowRightLeft, ArrowUpRight, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { formatAgo, formatDue, formatLocalDate, formatLocalTime } from "@/domain/business-hours";
import { isOpenStatus } from "@/domain/types";
import { cn, Dot, statusDotClass, TicketStatusLabel } from "@/components/ui/status";
import type { TicketView } from "@/services/tickets/types";

const COLLAPSED_COUNT = 4;

export function TicketsPanel({
  employeeName,
  tickets,
  error,
  currentNumber,
  onClose,
}: {
  employeeName: string;
  tickets: TicketView[] | null;
  error: string | null;
  currentNumber: string | null;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [openNumber, setOpenNumber] = useState<string | null>(null);
  const firstName = employeeName.split(" ")[0];
  const current = tickets?.find((t) => t.number === currentNumber) ?? null;
  const others = (tickets ?? []).filter((t) => t.number !== currentNumber);
  const visible = showAll ? others : others.slice(0, COLLAPSED_COUNT);
  const openCount = (tickets ?? []).filter((t) => isOpenStatus(t.status)).length;

  return (
    <aside className="border-rule bg-paper hidden w-[340px] shrink-0 flex-col border-l xl:flex">
      <header className="border-rule flex h-16 shrink-0 items-center gap-2 border-b pr-3.5 pl-5">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-ink text-[15.5px] font-semibold">Chamados de {firstName}</span>
          <span className="text-ink-3 text-[12.5px]">
            {tickets ? `${openCount} abertos · ${tickets.length - openCount} encerrados` : "—"}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar painel"
          className="text-ink-2 hover:bg-desk flex size-9 items-center justify-center rounded-full"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex flex-1 scrollbar-thin flex-col gap-8 overflow-y-auto px-5 pt-6 pb-5">
        {error && <p className="bg-warning-soft text-warning-text rounded-lg px-3 py-2 text-[13px]">{error}</p>}
        {!tickets && !error && <span className="bg-desk h-24 animate-pulse rounded-xl" />}

        {current && (
          <section className="flex flex-col gap-3">
            <h3 className="text-ink-3 text-[12.5px] font-semibold">Desta conversa</h3>
            <div className="bg-desk flex flex-col gap-3.5 rounded-xl p-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-3 text-[12.5px] font-medium">{current.number}</span>
                  <TicketStatusLabel status={current.status} strong />
                </div>
                <span className="text-ink text-[15.5px] font-semibold">{current.title}</span>
                <span className="text-ink-3 text-[13.5px]">
                  {current.category} · prioridade {current.priority.toLowerCase()}
                  {current.overdue && <span className="text-warning-text font-medium"> · vencido</span>}
                </span>
                <p className="text-ink-2 pt-1 text-[13px]">{current.description}</p>
              </div>
              {current.lastEvent && (
                <div className="border-rule flex items-center gap-2 border-t pt-3 text-[13.5px]">
                  <ArrowRightLeft size={14} className="text-ink-3 shrink-0" />
                  <span className="text-ink-2 flex-1">{current.lastEvent.text}</span>
                  <span className="text-ink-3 text-[12.5px]">{formatLocalTime(new Date(current.lastEvent.at))}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {tickets && (
          <section className="flex flex-col gap-1">
            <h3 className="text-ink-3 text-[12.5px] font-semibold">{current ? "Outros chamados" : "Chamados"}</h3>
            {others.length === 0 && <p className="text-ink-3 py-3 text-[13.5px]">Nenhum outro chamado.</p>}
            {visible.map((ticket, index) => (
              <div key={ticket.number} className={cn(index < visible.length - 1 && "border-rule border-b")}>
                <button
                  onClick={() => setOpenNumber((n) => (n === ticket.number ? null : ticket.number))}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <Dot className={statusDotClass(ticket.status)} size={7} />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-ink truncate text-[14.5px] font-medium">{ticket.title}</span>
                    <span className="text-ink-3 text-[12.5px]">
                      {ticket.number} ·{" "}
                      {ticket.resolvedAt
                        ? `${ticket.status} em ${formatLocalDate(new Date(ticket.resolvedAt))}`
                        : ticket.status}
                      {ticket.overdue && <span className="text-warning-text"> · vencido</span>}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className={cn("text-ink-3 shrink-0 transition", openNumber === ticket.number && "rotate-90")}
                  />
                </button>
                {openNumber === ticket.number && <TicketDetails ticket={ticket} />}
              </div>
            ))}
          </section>
        )}
      </div>

      {others.length > COLLAPSED_COUNT && (
        <footer className="border-rule border-t px-4 pt-3 pb-4">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="border-line text-ink-2 hover:bg-desk flex h-9 w-full items-center justify-center gap-[7px] rounded-lg border text-[13.5px] font-medium"
          >
            {showAll ? "Mostrar menos" : `Ver todos os chamados de ${firstName}`}
            <ArrowUpRight size={15} className="text-ink-3" />
          </button>
        </footer>
      )}
    </aside>
  );
}

function TicketDetails({ ticket }: { ticket: TicketView }) {
  const now = new Date();
  return (
    <dl className="bg-desk mb-3 grid grid-cols-2 gap-2 rounded-lg p-3 text-[12.5px]">
      <Item label="Categoria" value={ticket.category} />
      <Item label="Prioridade" value={ticket.priority} />
      <Item label="Última atualização" value={formatAgo(new Date(ticket.lastUpdateAt), now)} />
      <Item
        label="Prazo"
        value={ticket.dueAt ? (ticket.overdue ? "vencido" : formatDue(new Date(ticket.dueAt), now)) : "—"}
      />
      <p className="text-ink-2 col-span-2">{ticket.description}</p>
    </dl>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink font-medium">{value}</dd>
    </div>
  );
}
