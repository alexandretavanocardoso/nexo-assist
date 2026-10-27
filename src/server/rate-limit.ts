// Limite de mensagens por minuto por usuário, em memória (uma instância do servidor).
// Protege custo e abuso; com várias instâncias, troque por Redis ou similar.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function limitPerMinute(): number {
  const value = Number(process.env.RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(value) && value > 0 ? value : 8;
}

/** Registra uma tentativa e diz se está dentro do limite. */
export function allowRequest(key: string, limit = limitPerMinute(), now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
