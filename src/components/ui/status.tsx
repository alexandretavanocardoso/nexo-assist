// Pequenos indicadores visuais reutilizados no chat e no console.
import type { Priority, TicketStatus } from "@/domain/types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const STATUS_DOT: Record<TicketStatus, string> = {
  Aberto: "bg-primary",
  "Em andamento": "bg-primary",
  "Aguardando analista": "bg-warning",
  Aprovado: "bg-success",
  Resolvido: "bg-ink/25",
  Fechado: "bg-ink/25",
};

const STATUS_TEXT: Record<TicketStatus, string> = {
  Aberto: "text-primary-text",
  "Em andamento": "text-primary-text",
  "Aguardando analista": "text-warning-text",
  Aprovado: "text-success-text",
  Resolvido: "text-ink-3",
  Fechado: "text-ink-3",
};

const PRIORITY_DOT: Record<Priority, string> = {
  Crítica: "bg-danger",
  Alta: "bg-warning",
  Média: "bg-ink/40",
  Baixa: "bg-ink/20",
};

export function Dot({ className, size = 6 }: { className: string; size?: number }) {
  return <span className={cn("inline-block shrink-0 rounded-full", className)} style={{ width: size, height: size }} />;
}

export function TicketStatusLabel({ status, strong = false }: { status: TicketStatus; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px]",
        strong ? cn("font-medium", STATUS_TEXT[status]) : "text-ink-3",
      )}
    >
      <Dot className={STATUS_DOT[status]} />
      {status}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot className={PRIORITY_DOT[priority]} />
      {priority}
    </span>
  );
}

export function statusDotClass(status: TicketStatus): string {
  return STATUS_DOT[status];
}
