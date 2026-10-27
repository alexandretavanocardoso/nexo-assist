import { openDatabase, type Db } from "@/server/db/client";
import { LegacyGateway } from "@/services/tickets/legacy-gateway";
import { TicketService } from "@/services/tickets/ticket-service";
import { NOW } from "./time";

export { brt, NOW } from "./time";

export function createTestDb(now: Date = NOW): Db {
  return openDatabase(":memory:", { seedNow: now });
}

export function createTestTicketService(options: { now?: Date; outageRate?: number } = {}) {
  const now = options.now ?? NOW;
  const db = createTestDb(now);
  const gateway = new LegacyGateway({ outageRate: options.outageRate ?? 0, outageMs: 3000, latencyMs: 0 });
  const service = new TicketService(db, gateway, () => now);
  return { db, gateway, service, now };
}

export const ANA = { id: "e-ana", role: "employee" as const };
export const BRUNO = { id: "e-bruno", role: "employee" as const };
export const RAFAEL = { id: "a-rafael", role: "analyst" as const };
