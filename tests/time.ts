/** Horário de Brasília (UTC-3) como Date. Ex.: brt("2026-10-27T10:30"). */
export function brt(localIso: string): Date {
  return new Date(`${localIso}:00-03:00`);
}

/** Terça-feira, 27/10/2026, 10:30 em Brasília: o "agora" dos testes. */
export const NOW = brt("2026-10-27T10:30");
