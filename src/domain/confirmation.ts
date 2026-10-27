// Confirmação explícita do funcionário para um rascunho pendente.
// Criar, atualizar ou reabrir um chamado só acontece depois dela: pelo botão
// "Confirmar" ou por uma mensagem curta e inequívoca. Respostas ambíguas
// ("acho que sim, mas...") vão para o agent, que pergunta de novo.
import { normalize } from "./similarity";

const CONFIRMATIONS = [
  "sim",
  "s",
  "ok",
  "okay",
  "confirmo",
  "confirmar",
  "confirmado",
  "pode",
  "pode criar",
  "pode abrir",
  "pode atualizar",
  "pode reabrir",
  "pode sim",
  "sim pode",
  "sim pode criar",
  "sim pode abrir",
  "sim confirmo",
  "isso",
  "isso mesmo",
  "correto",
  "esta correto",
  "esta certo",
  "certo",
  "perfeito",
  "manda",
  "pode mandar",
  "fechado",
  "de acordo",
];

const CANCELLATIONS = ["nao", "cancelar", "cancela", "cancele", "nao precisa", "deixa pra la", "desisti", "esquece"];

function clean(text: string): string {
  return normalize(text)
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isExplicitConfirmation(text: string): boolean {
  return CONFIRMATIONS.includes(clean(text));
}

export function isExplicitCancellation(text: string): boolean {
  return CANCELLATIONS.includes(clean(text));
}
