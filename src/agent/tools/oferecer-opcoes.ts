import { z } from "zod";
import { defineNexoTool } from "../define-tool";

export const oferecerOpcoes = defineNexoTool({
  id: "oferecer_opcoes",
  description:
    "Mostra botões de resposta rápida abaixo da sua mensagem. Use quando fizer uma pergunta com poucas respostas " +
    "possíveis (ex.: quem é afetado: 'Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei').",
  inputSchema: z.object({
    opcoes: z.array(z.string().min(1).max(40)).min(2).max(4),
  }),
  labels: () => [],
  run: async ({ opcoes }, turn) => {
    turn.recorder.addBlock({ type: "quick-replies", options: opcoes });
    return { output: { ok: true } };
  },
});
