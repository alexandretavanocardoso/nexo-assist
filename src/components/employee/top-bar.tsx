import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function TopBar({ here, children }: { here: string; children?: ReactNode }) {
  return (
    <header className="border-rule flex h-16 shrink-0 items-center gap-4 border-b px-8">
      <div className="flex flex-1 items-center gap-2 text-[13.5px]">
        <span className="text-ink-3">Service desk de TI</span>
        <ChevronRight size={14} className="text-ink-3" />
        <span className="text-ink font-semibold">{here}</span>
      </div>
      {children}
    </header>
  );
}
