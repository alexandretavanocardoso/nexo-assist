import { z } from "zod";
import { searchArticles } from "@/services/helpcenter/search";
import { defineNexoTool } from "../define-tool";

export const buscarCentralAjuda = defineNexoTool({
  id: "buscar_central_ajuda",
  description:
    "Busca artigos da central de ajuda de TI. Use para dúvidas e antes de abrir chamado: se um artigo resolver, " +
    "responda com base nele (sem abrir chamado). Responda só com o que estiver nos artigos.",
  inputSchema: z.object({
    consulta: z.string().min(2).max(200).describe("Palavras-chave do problema ou da dúvida."),
  }),
  labels: () => ["buscou na central de ajuda"],
  run: async ({ consulta }, turn) => {
    const matches = searchArticles(consulta);
    if (matches.length > 0) {
      turn.recorder.addBlock({
        type: "articles",
        articles: matches.map(({ article }) => ({ id: article.id, title: article.title })),
      });
    }
    return {
      output: {
        artigos: matches.map(({ article, score }) => ({
          id: article.id,
          titulo: article.title,
          conteudo: article.body,
          relevancia: score,
        })),
      },
      rules: ["Dúvidas são respondidas com base na central de ajuda, sem abrir chamado"],
    };
  },
});
