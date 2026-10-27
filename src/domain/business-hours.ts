// Calendário de horas úteis do service desk: segunda a sexta, das 8h às 18h,
// no horário de Brasília (UTC-3, sem horário de verão desde 2019).
// Feriados não são considerados (decisão registrada no README).

export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 18;
export const BUSINESS_DAY_MINUTES = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60;

const OFFSET_MS = -3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** "Relógio de parede" de Brasília representado como Date em UTC (use getUTC*). */
function toLocal(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MS);
}

function fromLocal(local: Date): Date {
  return new Date(local.getTime() - OFFSET_MS);
}

function isWeekday(local: Date): boolean {
  const day = local.getUTCDay();
  return day !== 0 && day !== 6;
}

function atHour(local: Date, hour: number): Date {
  const copy = new Date(local);
  copy.setUTCHours(hour, 0, 0, 0);
  return copy;
}

/** Leva o instante para o próximo momento dentro do expediente (ou mantém, se já estiver dentro). */
function nextBusinessMoment(local: Date): Date {
  let cursor = new Date(local);
  for (;;) {
    if (!isWeekday(cursor)) {
      cursor = atHour(new Date(cursor.getTime() + 24 * 60 * MINUTE_MS), BUSINESS_START_HOUR);
      continue;
    }
    const start = atHour(cursor, BUSINESS_START_HOUR);
    const end = atHour(cursor, BUSINESS_END_HOUR);
    if (cursor < start) return start;
    if (cursor >= end) {
      cursor = atHour(new Date(cursor.getTime() + 24 * 60 * MINUTE_MS), BUSINESS_START_HOUR);
      continue;
    }
    return cursor;
  }
}

/** Soma minutos úteis a um instante. Ex.: sexta 17h + 4h úteis = segunda 11h. */
export function addBusinessMinutes(start: Date, minutes: number): Date {
  let cursor = nextBusinessMoment(toLocal(start));
  let remaining = minutes;
  for (;;) {
    const endOfDay = atHour(cursor, BUSINESS_END_HOUR);
    const available = (endOfDay.getTime() - cursor.getTime()) / MINUTE_MS;
    if (remaining <= available) {
      return fromLocal(new Date(cursor.getTime() + remaining * MINUTE_MS));
    }
    remaining -= available;
    cursor = nextBusinessMoment(endOfDay);
  }
}

/** Indica se o instante está dentro do expediente do service desk. */
export function isWithinBusinessHours(date: Date): boolean {
  const local = toLocal(date);
  return nextBusinessMoment(local).getTime() === local.getTime();
}

/** Hora local (Brasília) formatada como "13:43". */
export function formatLocalTime(date: Date): string {
  const local = toLocal(date);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Data local curta, ex.: "16 out". */
export function formatLocalDate(date: Date): string {
  const local = toLocal(date);
  return `${String(local.getUTCDate()).padStart(2, "0")} ${MONTHS[local.getUTCMonth()]}`;
}

/** Data e hora locais, ex.: "16 out, 14:20". */
export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)}, ${formatLocalTime(date)}`;
}

/** Ex.: "terça, 27 out, 10:30". Usado no contexto enviado ao agent. */
export function formatLocalWeekdayDateTime(date: Date): string {
  return `${WEEKDAYS[toLocal(date).getUTCDay()]}, ${formatLocalDateTime(date)}`;
}

/** Prazo legível: "hoje às 13:43", "amanhã às 11:00" ou "30 out, 10:00". */
export function formatDue(due: Date, now: Date): string {
  const dayDiff = Math.round(
    (atHour(toLocal(due), 0).getTime() - atHour(toLocal(now), 0).getTime()) / (24 * 60 * MINUTE_MS),
  );
  if (dayDiff === 0) return `hoje às ${formatLocalTime(due)}`;
  if (dayDiff === 1) return `amanhã às ${formatLocalTime(due)}`;
  return formatLocalDateTime(due);
}

/** Tempo decorrido em linguagem natural: "há 5 min", "há 3 h", "há 6 dias". */
export function formatAgo(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MINUTE_MS));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}
