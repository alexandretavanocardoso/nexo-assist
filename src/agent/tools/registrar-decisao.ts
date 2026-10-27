import { z } from "zod";
import { defineNexoTool } from "../define-tool";
import { INTENTS } from "../trace";

// Intenções que o modelo pode declarar (confirmação/cancelamento são ações do servidor).
const MODEL_INTENTS = INTENTS.filter((i) => i !== "confirmacao" && i !== "cancelamento") as [
  (typeof INTENTS)[number],
  ...(typeof INTENTS)[number][],
];

export const registrarDecisao = defineNexoTool({
  id: "registrar_decisao",
  description:
    "Registra o que você entendeu e o que vai fazer. Chame SEMPRE como primeira ação de cada resposta " +
    "(e de novo se mudar de ideia depois de consultar algo). O funcionário vê esse registro para entender suas decisões.",
  inputSchema: z.object({
    intencao: z.enum(MODEL_INTENTS).describe("Intenção principal da mensagem do funcionário."),
    entendimento: z.string().min(5).max(300).describe("O que o funcionário quer, em uma frase, na 2ª pessoa (\"Você quer...\")."),
    acao: z.string().min(3).max(200).describe("A ação que você vai tomar, em uma frase."),
    confianca: z.number().min(0).max(1).describe("Sua segurança de que essa é a ação certa, de 0 a 1."),
    justificativa: z.string().min(5).max(400).describe("Por que essa ação, citando a regra do service desk quando houver."),
  }),
  labels: () => [],
  run: async (input, turn) => {
    turn.recorder.decision = {
      intent: input.intencao,
      understood: input.entendimento,
      action: input.acao,
      confidence: input.confianca,
      rationale: input.justificativa,
    };
    return { output: { ok: true } };
  },
});
