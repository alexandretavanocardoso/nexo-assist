// Log estruturado em JSON (uma linha por evento), fácil de filtrar e de mandar para
// qualquer coletor. Nunca registre conteúdo sensível (senhas, chaves).
// Nível mínimo: LOG_LEVEL (debug | info | warn | error); nos testes, só erros.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): Level {
  const configured = process.env.LOG_LEVEL;
  if (configured && configured in LEVELS) return configured as Level;
  return process.env.NODE_ENV === "test" ? "error" : "info";
}

function serializeError(error: unknown): Fields {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { message: String(error) };
}

function write(level: Level, event: string, fields: Fields = {}): void {
  if (LEVELS[level] < LEVELS[minLevel()]) return;
  const entry: Fields = { time: new Date().toISOString(), level, event, ...fields };
  if (fields.error !== undefined) entry.error = serializeError(fields.error);
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
