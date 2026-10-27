"use client";

import { BookOpen, TriangleAlert } from "lucide-react";
import { formatAgo, formatDue, formatLocalDate, formatLocalDateTime } from "@/domain/business-hours";
import { IMPACT_LABELS } from "@/domain/types";
import { cn, Dot, PriorityLabel, statusDotClass, TicketStatusLabel } from "@/components/ui/status";
import type { DraftView, UiBlock } from "@/services/conversations/types";
import type { TicketView } from "@/services/tickets/types";

export type BlockActions = {
  /** Os controles só ficam ativos na última resposta. */
  interactive: boolean;
  busy: boolean;
  /** Resposta que o funcionário deu logo depois (destaca a opção escolhida no histórico). */
  answer?: string;
  onSend: (text: string) => void;
  onConfirm: (draftId: string) => void;
  onCancel: (draftId: string) => void;
  onEdit: () => void;
};

export function Block({ block, actions }: { block: UiBlock; actions: BlockActions }) {
  switch (block.type) {
    case "ticket-card":
      return <TicketCard ticket={block.ticket} />;
    case "ticket-selector":
      return <TicketSelector tickets={block.tickets} actions={actions} />;
    case "draft":
      return <DraftCard draft={block.draft} actions={actions} />;
    case "quick-replies":
      return <QuickReplies options={block.options} actions={actions} />;
    case "articles":
      return (
        <p className="text-ink-3 flex flex-wrap items-center gap-1.5 text-[12px]">
          <BookOpen size={13} />
          Central de ajuda:
          {block.articles.map((a) => (
            <span key={a.id} className="bg-desk text-ink-2 rounded-md px-1.5 py-0.5">
              {a.id} · {a.title}
            </span>
          ))}
        </p>
      );
    case "notice":
      return (
        <p
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]",
            block.tone === "error"
              ? "bg-danger-soft text-danger-text"
              : block.tone === "warning"
                ? "bg-warning-soft text-warning-text"
                : "bg-desk text-ink-2",
          )}
        >
          <TriangleAlert size={14} />
          {block.text}
        </p>
      );
  }
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="border-ink/10 bg-paper w-full overflow-hidden rounded-2xl border">{children}</div>;
}

function Eyebrow({ kind, code, right }: { kind: string; code: string; right: React.ReactNode }) {
  return (
    <div className="text-ink-3 flex items-center gap-2 pb-0.5 text-[12.5px]">
      <span className="font-medium">{kind}</span>
      <span className="bg-rule size-[3px] rounded-full" />
      <span>{code}</span>
      <span className="flex-1" />
      {right}
    </div>
  );
}

function FieldGrid({ fields }: { fields: Array<{ key: string; value: React.ReactNode }> }) {
  return (
    <div className="px-[18px] pb-4">
      <div className="border-rule grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-3 sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <span className="text-ink-3 text-[12.5px]">{field.key}</span>
            <span className="text-ink text-[14.5px] font-medium">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TicketCard({ ticket }: { ticket: TicketView }) {
  const now = new Date();
  return (
    <CardShell>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <Eyebrow kind="Chamado" code={ticket.number} right={<TicketStatusLabel status={ticket.status} strong />} />
        <h3 className="text-ink text-lg font-semibold">{ticket.title}</h3>
        <p className="text-ink-2 text-[13.5px]">{ticket.description}</p>
      </div>
      <FieldGrid
        fields={[
          { key: "Categoria", value: ticket.category },
          { key: "Prioridade", value: <PriorityLabel priority={ticket.priority} /> },
          { key: "Aberto em", value: formatLocalDateTime(new Date(ticket.openedAt)) },
          {
            key: ticket.resolvedAt ? "Resolvido em" : "Última atualização",
            value: ticket.resolvedAt ? (
              formatLocalDate(new Date(ticket.resolvedAt))
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={ticket.overdue ? "text-warning-text" : undefined}>
                  {formatAgo(new Date(ticket.lastUpdateAt), now)}
                </span>
                <span className="text-ink-3 text-[13.5px] font-normal">
                  {ticket.overdue
                    ? "· prazo vencido"
                    : ticket.dueAt
                      ? `· próxima até ${formatDue(new Date(ticket.dueAt), now)}`
                      : ""}
                </span>
              </span>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

function TicketSelector({ tickets, actions }: { tickets: TicketView[]; actions: BlockActions }) {
  return (
    <CardShell>
      {tickets.map((ticket, index) => {
        const chosen = actions.answer?.startsWith(ticket.number) ?? false;
        return (
          <button
            key={ticket.number}
            disabled={!actions.interactive || actions.busy}
            onClick={() => actions.onSend(`${ticket.number} · ${ticket.title}`)}
            className={cn(
              "group enabled:hover:bg-cta/5 flex min-h-[46px] w-full items-center gap-3.5 px-4 py-2 text-left disabled:cursor-default",
              index > 0 && "border-rule border-t",
              chosen && "bg-cta/5",
            )}
          >
            <span
              className={cn(
                "bg-paper group-enabled:group-hover:border-cta size-4 shrink-0 rounded-full border group-enabled:group-hover:border-[5px]",
                chosen ? "border-cta border-[5px]" : "border-ink/20",
              )}
            />
            <span className="text-ink-3 w-[76px] shrink-0 text-[12.5px] font-medium">{ticket.number}</span>
            <span className="text-ink flex-1 text-[14.5px] font-medium">{ticket.title}</span>
            <span className="text-ink-3 hidden items-center gap-1.5 text-[12.5px] sm:inline-flex">
              <Dot className={statusDotClass(ticket.status)} />
              {ticket.status}
              {ticket.overdue && <span className="text-warning-text">· vencido</span>}
            </span>
            <span className="text-ink-3 w-11 shrink-0 text-right text-[12.5px]">
              {formatLocalDate(new Date(ticket.openedAt))}
            </span>
          </button>
        );
      })}
    </CardShell>
  );
}

const DRAFT_STATE: Record<DraftView["status"], { label: string; dot: string; text: string }> = {
  pending: { label: "Aguardando confirmação", dot: "bg-warning", text: "text-warning-text" },
  committed: { label: "Confirmado", dot: "bg-success", text: "text-success-text" },
  cancelled: { label: "Cancelado", dot: "bg-ink/25", text: "text-ink-3" },
  superseded: { label: "Substituído por outro rascunho", dot: "bg-ink/25", text: "text-ink-3" },
};

function DraftCard({ draft, actions }: { draft: DraftView; actions: BlockActions }) {
  const state = DRAFT_STATE[draft.status];
  const payload = draft.payload;
  const active = draft.status === "pending" && actions.interactive;
  const kind =
    payload.kind === "create"
      ? payload.type === "INC"
        ? "Novo incidente (INC)"
        : "Nova requisição (REQ)"
      : payload.kind === "update"
        ? `Atualizar ${payload.ticketNumber}`
        : `Reabrir ${payload.ticketNumber}`;

  return (
    <CardShell>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <Eyebrow
          kind={kind}
          code={`Rascunho ${draft.code}`}
          right={
            <span className={cn("inline-flex items-center gap-1.5 font-medium", state.text)}>
              <Dot className={state.dot} />
              {draft.status === "committed" && draft.ticketNumber ? `Confirmado · ${draft.ticketNumber}` : state.label}
            </span>
          }
        />
        <h3 className="text-ink text-lg font-semibold">
          {payload.kind === "create" ? payload.title : payload.ticketTitle}
        </h3>
        <p className="text-ink-2 text-[13.5px] whitespace-pre-line">
          {payload.kind === "create"
            ? payload.description
            : payload.kind === "update"
              ? payload.note
              : `Motivo: ${payload.reason}`}
        </p>
      </div>
      {payload.kind === "create" && (
        <FieldGrid
          fields={[
            { key: "Categoria", value: payload.category },
            {
              key: "Prioridade",
              value: (
                <span className="flex flex-wrap items-center gap-1.5">
                  <PriorityLabel priority={payload.priority} />
                  <span className="text-ink-3 text-[13.5px] font-normal">
                    · resposta até {formatDueShort(new Date(payload.dueAt))}
                  </span>
                </span>
              ),
            },
            { key: "Afetados", value: IMPACT_LABELS[payload.impact] },
          ]}
        />
      )}
      {active && (
        <div className="border-rule bg-desk flex flex-wrap items-center gap-1.5 border-t py-2 pr-3.5 pl-2">
          <button
            disabled={actions.busy}
            onClick={() => actions.onConfirm(draft.id)}
            className="bg-cta hover:bg-cta-hover flex h-9 items-center gap-2 rounded-lg pr-2.5 pl-3.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
          >
            Confirmar
            <kbd className="rounded-md bg-white/15 px-[5px] py-px text-[11.5px] font-normal text-white/80">Ctrl ↵</kbd>
          </button>
          <button
            disabled={actions.busy}
            onClick={actions.onEdit}
            className="border-line bg-paper text-ink hover:bg-desk h-9 rounded-lg border px-3.5 text-[13.5px] font-medium disabled:opacity-60"
          >
            Editar
          </button>
          <button
            disabled={actions.busy}
            onClick={() => actions.onCancel(draft.id)}
            className="text-ink-2 hover:bg-ink/5 h-9 rounded-lg px-3.5 text-[13.5px] font-medium disabled:opacity-60"
          >
            Cancelar
          </button>
          {payload.kind === "create" && (
            <span className="text-ink-3 ml-auto hidden text-[12px] md:inline" title={payload.priorityReason}>
              Prioridade calculada pela regra impacto × urgência
            </span>
          )}
        </div>
      )}
    </CardShell>
  );
}

/** "13:43" se for hoje; senão "amanhã às 11:00" ou "30 out, 10:00". */
function formatDueShort(due: Date): string {
  const text = formatDue(due, new Date());
  return text.startsWith("hoje às ") ? text.slice("hoje às ".length) : text;
}

function QuickReplies({ options, actions }: { options: string[]; actions: BlockActions }) {
  // No histórico, as opções ficam desativadas e a escolhida aparece destacada.
  if (!actions.interactive && !actions.answer) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option, index) => (
        <button
          key={option}
          disabled={actions.busy || !actions.interactive}
          onClick={() => actions.onSend(option)}
          className={cn(
            "enabled:hover:border-primary enabled:hover:bg-primary-soft enabled:hover:text-primary-text flex items-center gap-[7px] rounded-lg border py-[7px] pr-3 pl-2 text-[13.5px] font-medium disabled:cursor-default",
            actions.answer?.startsWith(option)
              ? "border-primary bg-primary-soft text-primary-text"
              : cn("border-rule bg-paper text-ink", !actions.interactive && "opacity-50"),
          )}
        >
          <span className="bg-desk text-ink-3 flex size-4 items-center justify-center rounded-md text-[11.5px]">
            {index + 1}
          </span>
          {option}
        </button>
      ))}
    </div>
  );
}
