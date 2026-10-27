// Fábrica das ferramentas do Nexo Assist. Envolve o createTool do Mastra para que toda
// ferramenta, sem repetir código:
// - receba o contexto do turno (funcionário autenticado, serviços);
// - registre a etapa no decision trace (entrada, saída, regras, tentativas, duração);
// - avise a interface em tempo real ("consultou seus chamados");
// - nunca lance erro para o modelo: falhas viram uma saída { ok: false } que ele sabe explicar.
import { createTool } from "@mastra/core/tools";
import type { z } from "zod";
import { logger } from "@/server/logger";
import type { TurnContext } from "./turn";

export type ToolRunResult = {
  output: Record<string, unknown>;
  /** "error" = falha de sistema (ex.: chamados fora do ar). Regras de negócio que barram a ação são "ok". */
  status?: "ok" | "error";
  rules?: string[];
  /** Rótulos finais da etapa, quando dependem do resultado. */
  labels?: string[];
  attempts?: number;
};

export function defineNexoTool<TSchema extends z.ZodType>(definition: {
  id: string;
  description: string;
  inputSchema: TSchema;
  /** Rótulos exibidos acima da resposta enquanto a ferramenta roda. */
  labels: (input: z.infer<TSchema>) => string[];
  run: (input: z.infer<TSchema>, turn: TurnContext) => Promise<ToolRunResult>;
}) {
  return createTool({
    id: definition.id,
    description: definition.description,
    inputSchema: definition.inputSchema,
    execute: async (input, context) => {
      const turn = context.requestContext?.get("turn") as TurnContext | undefined;
      if (!turn) throw new Error(`Ferramenta ${definition.id} chamada sem contexto de turno.`);

      const data = input as z.infer<TSchema>;
      const step = turn.recorder.startStep(definition.id, definition.labels(data), data);
      try {
        const result = await definition.run(data, turn);
        step.finish({
          output: result.output,
          status: result.status ?? "ok",
          attempts: result.attempts ?? 1,
          rules: result.rules ?? [],
          labels: result.labels,
        });
        return result.output;
      } catch (error) {
        logger.error("agent.tool_failed", { tool: definition.id, conversationId: turn.conversationId, error });
        const output = { ok: false, erro: "falha_interna", mensagem: "Erro inesperado ao executar a ação." };
        step.finish({ output, status: "error", attempts: 1, rules: [] });
        return output;
      }
    },
  });
}
