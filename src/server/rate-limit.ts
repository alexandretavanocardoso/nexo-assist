// Limites de uso, em memória (uma instância do servidor). Protegem custo e abuso;
// com várias instâncias, troque por Redis ou similar.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function limitPerMinute(): number {
  return numberFromEnv("RATE_LIMIT_PER_MINUTE", 8);
}

/** Por funcionário: registra uma tentativa e diz se está dentro do limite por minuto. */
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

const daily = { day: "", count: 0 };

/** Teto global de mensagens processadas por dia: trava o custo máximo de um deploy público. */
export function allowDailyBudget(limit = numberFromEnv("DAILY_MESSAGE_LIMIT", 1000), now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  if (daily.day !== day) {
    daily.day = day;
    daily.count = 0;
  }
  if (daily.count >= limit) return false;
  daily.count++;
  return true;
}
