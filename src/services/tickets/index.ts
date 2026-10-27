import { getDb } from "@/server/db/client";
import { LegacyGateway } from "./legacy-gateway";
import { TicketService } from "./ticket-service";

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && process.env[name] !== "" && process.env[name] !== undefined ? value : fallback;
}

// Uma instância por processo: a "queda" do sistema legado vale para todos os usuários.
const globalForTickets = globalThis as unknown as { nexoTickets?: { service: TicketService; gateway: LegacyGateway } };

function instance() {
  if (!globalForTickets.nexoTickets) {
    const gateway = new LegacyGateway({
      outageRate: numberFromEnv("TICKETS_OUTAGE_RATE", 0.08),
      outageMs: numberFromEnv("TICKETS_OUTAGE_MS", 3000),
      latencyMs: numberFromEnv("TICKETS_LATENCY_MS", 150),
    });
    globalForTickets.nexoTickets = { service: new TicketService(getDb(), gateway), gateway };
  }
  return globalForTickets.nexoTickets;
}

export function getTicketService(): TicketService {
  return instance().service;
}

export function getLegacyGateway(): LegacyGateway {
  return instance().gateway;
}
