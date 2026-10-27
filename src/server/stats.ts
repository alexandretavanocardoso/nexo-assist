// Indicadores da tela de login, calculados a partir dos dados reais (e não fixos no código).
import { eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { conversations, employees, messages } from "@/server/db/schema";

export type LoginStats = { firstResponse: string; resolvedWithoutQueue: string; analysts: number };

export function getLoginStats(db: Db): LoginStats {
  const traces = db
    .select({ trace: messages.trace })
    .from(messages)
    .where(isNotNull(messages.trace))
    .all()
    .flatMap(({ trace }) =>
      trace?.source === "agent" && trace.metrics.firstTokenMs !== null ? [trace.metrics.firstTokenMs] : [],
    );
  const all = db.select({ handoff: conversations.handoff }).from(conversations).all();
  const withoutQueue = all.filter((c) => !c.handoff).length;
  const analysts = db.select({ id: employees.id }).from(employees).where(eq(employees.role, "analyst")).all().length;

  const average = traces.length ? traces.reduce((sum, ms) => sum + ms, 0) / traces.length / 1000 : null;
  return {
    firstResponse: average === null ? "—" : `${average.toFixed(1).replace(".", ",")} s`,
    resolvedWithoutQueue: all.length ? `${Math.round((withoutQueue / all.length) * 100)}%` : "—",
    analysts,
  };
}
