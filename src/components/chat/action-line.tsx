"use client";

// Linha acima de cada resposta: "Nexo Assist ✓ consultou seus chamados ✓ calculou o prazo [ver decisão]".
import { Check, ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/components/ui/status";

export type ActionChip = { label: string; status: "running" | "done" | "error" };

export function ActionLine({
  chips,
  canExpand,
  expanded,
  onToggle,
}: {
  chips: ActionChip[];
  canExpand: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
      <span className="text-ink font-semibold">Nexo Assist</span>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={cn(
            "inline-flex items-center gap-[5px]",
            chip.status === "error" ? "text-warning-text" : "text-ink-3",
          )}
        >
          {chip.status === "running" && <LoaderCircle size={12} className="animate-spin" />}
          {chip.status === "done" && <Check size={12} />}
          {chip.status === "error" && <TriangleAlert size={12} />}
          {chip.label}
        </span>
      ))}
      {canExpand && (
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="text-primary-text hover:bg-primary-soft inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium"
        >
          {expanded ? "ocultar decisão" : "ver decisão"}
          <ChevronDown size={13} className={cn("transition", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
