// Modelo "roteirizado" (especificação LanguageModelV2 da AI SDK, suportada pelo Mastra).
// Cada chamada ao modelo devolve o próximo passo do roteiro: chamadas de ferramenta ou texto.
// Permite testar o pipeline inteiro (Mastra, ferramentas, trace, persistência) sem chamar a API.
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from "@ai-sdk/provider-v5";

export type ScriptStep = {
  text?: string;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
};

export function scriptedModel(steps: ScriptStep[]) {
  const calls: LanguageModelV2CallOptions[] = [];
  let index = 0;

  const model: LanguageModelV2 = {
    specificationVersion: "v2",
    provider: "scripted",
    modelId: "scripted",
    supportedUrls: {},
    async doGenerate() {
      throw new Error("O modelo roteirizado só suporta streaming.");
    },
    async doStream(options) {
      calls.push(options);
      const step = steps[index++] ?? { text: "(fim do roteiro)" };
      const parts: LanguageModelV2StreamPart[] = [{ type: "stream-start", warnings: [] }];
      if (step.text) {
        parts.push({ type: "text-start", id: `t${index}` });
        parts.push({ type: "text-delta", id: `t${index}`, delta: step.text });
        parts.push({ type: "text-end", id: `t${index}` });
      }
      (step.toolCalls ?? []).forEach((call, i) => {
        parts.push({
          type: "tool-call",
          toolCallId: `call-${index}-${i}`,
          toolName: call.name,
          input: JSON.stringify(call.input),
        });
      });
      parts.push({
        type: "finish",
        finishReason: step.toolCalls?.length ? "tool-calls" : "stop",
        usage: { inputTokens: 1000, outputTokens: 50, totalTokens: 1050 },
      });
      return {
        stream: new ReadableStream<LanguageModelV2StreamPart>({
          start(controller) {
            parts.forEach((part) => controller.enqueue(part));
            controller.close();
          },
        }),
      };
    },
  };

  return { model, calls, remaining: () => steps.length - index };
}

/** Atalho para o passo inicial: registrar a decisão junto com outras ferramentas. */
export function decide(intencao: string, confianca = 0.9) {
  return {
    name: "registrar_decisao",
    input: {
      intencao,
      entendimento: "Você quer ajuda com um problema de TI.",
      acao: "Usar as ferramentas adequadas.",
      confianca,
      justificativa: "Teste roteirizado.",
    },
  };
}
