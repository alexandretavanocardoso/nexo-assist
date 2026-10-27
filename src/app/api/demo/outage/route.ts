import { NextResponse } from "next/server";
import { requireUser, route } from "@/server/http";
import { logger } from "@/server/logger";
import { getLegacyGateway } from "@/services/tickets";

const OUTAGE_MS = 10_000;

/** Demonstração: derruba o sistema de chamados simulado por 10 s para ver o retry em ação. */
export const POST = route(async () => {
  const analyst = await requireUser("analyst");
  getLegacyGateway().forceOutage(OUTAGE_MS);
  logger.warn("tickets.outage_forced", { by: analyst.id, durationMs: OUTAGE_MS });
  return NextResponse.json({ until: new Date(Date.now() + OUTAGE_MS).toISOString() });
});
