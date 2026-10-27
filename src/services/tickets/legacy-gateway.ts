// Simula o sistema de chamados legado: cada chamada tem latência e, de vez em quando,
// o sistema "cai" por alguns segundos. Durante a queda, todas as chamadas falham.
import { logger } from "@/server/logger";
import { TicketServiceUnavailableError } from "./errors";

export type LegacyGatewayOptions = {
  /** Chance (0 a 1) de cada chamada iniciar uma queda. */
  outageRate: number;
  /** Duração de cada queda, em ms. */
  outageMs: number;
  /** Latência de cada chamada, em ms. */
  latencyMs: number;
  random?: () => number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class LegacyGateway {
  private outageUntil = 0;
  private readonly random: () => number;

  constructor(private readonly options: LegacyGatewayOptions) {
    this.random = options.random ?? Math.random;
  }

  async call<T>(operation: string, run: () => T): Promise<T> {
    if (this.options.latencyMs > 0) await sleep(this.options.latencyMs);

    const now = Date.now();
    if (now < this.outageUntil) throw new TicketServiceUnavailableError(operation);
    if (this.random() < this.options.outageRate) {
      this.outageUntil = now + this.options.outageMs;
      logger.warn("tickets.outage_started", { operation, durationMs: this.options.outageMs });
      throw new TicketServiceUnavailableError(operation);
    }
    return run();
  }

  /** Força uma queda (usado em testes, evals e no endpoint de demonstração). */
  forceOutage(durationMs: number): void {
    this.outageUntil = Date.now() + durationMs;
  }

  isDown(): boolean {
    return Date.now() < this.outageUntil;
  }
}
