// Retry com espera exponencial para o sistema de chamados, que cai por alguns segundos.
// Com os valores padrão: 4 tentativas, esperando 0,7 s, 1,4 s e 2,8 s (cobre ~5 s de queda).
import { TicketServiceUnavailableError } from "./errors";

export type RetryResult<T> = { ok: true; value: T; attempts: number } | { ok: false; error: unknown; attempts: number };

export type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  onRetry?: (info: { attempt: number; maxAttempts: number; delayMs: number; error: unknown }) => void;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(run: () => Promise<T>, options: RetryOptions = {}): Promise<RetryResult<T>> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 700;
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = retries + 1;

  for (let attempt = 1; ; attempt++) {
    try {
      return { ok: true, value: await run(), attempts: attempt };
    } catch (error) {
      // Só vale tentar de novo quando o sistema está fora do ar; outros erros são definitivos.
      const retryable = error instanceof TicketServiceUnavailableError;
      if (!retryable || attempt >= maxAttempts) return { ok: false, error, attempts: attempt };
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.({ attempt, maxAttempts, delayMs, error });
      await sleep(delayMs);
    }
  }
}
