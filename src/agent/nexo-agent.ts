import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { NEXO_INSTRUCTIONS } from "./instructions";
import { createDefaultModel } from "./model";
import { buscarCentralAjuda } from "./tools/buscar-central-ajuda";
import { consultarChamado, listarMeusChamados } from "./tools/chamados";
import { oferecerOpcoes } from "./tools/oferecer-opcoes";
import { prepararAtualizacaoChamado, prepararRascunhoChamado, prepararReaberturaChamado } from "./tools/rascunhos";
import { registrarDecisao } from "./tools/registrar-decisao";
import { transferirParaAnalista } from "./tools/transferir";

export const NEXO_TOOLS = {
  registrar_decisao: registrarDecisao,
  buscar_central_ajuda: buscarCentralAjuda,
  listar_meus_chamados: listarMeusChamados,
  consultar_chamado: consultarChamado,
  preparar_rascunho_chamado: prepararRascunhoChamado,
  preparar_atualizacao_chamado: prepararAtualizacaoChamado,
  preparar_reabertura_chamado: prepararReaberturaChamado,
  transferir_para_analista: transferirParaAnalista,
  oferecer_opcoes: oferecerOpcoes,
};

/** O modelo é injetável: os testes usam um modelo roteirizado, sem chamar a API. */
export function createNexoAgent(model: MastraModelConfig = createDefaultModel()): Agent {
  return new Agent({
    id: "nexo-assist",
    name: "Nexo Assist",
    instructions: {
      role: "system",
      content: NEXO_INSTRUCTIONS,
      // Instruções e ferramentas são iguais em toda chamada: o cache de prompt reduz custo e latência.
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    model,
    tools: NEXO_TOOLS,
  });
}

const globalForAgent = globalThis as unknown as { nexoAgent?: Agent };

export function getNexoAgent(): Agent {
  globalForAgent.nexoAgent ??= createNexoAgent();
  return globalForAgent.nexoAgent;
}
