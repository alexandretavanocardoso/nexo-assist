import type { StreamEvent } from "@/lib/stream-events";
import { logger } from "@/server/logger";

/** Resposta em Server-Sent Events: cada evento vira uma linha "data: {json}". */
export function sseResponse(run: (emit: (event: StreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false; // o navegador fechou a conexão; o turno continua e é salvo mesmo assim
        }
      };
      try {
        await run(emit);
      } catch (error) {
        logger.error("sse.failed", { error });
        emit({ type: "error", code: "internal", message: "Erro inesperado.", retryable: true });
      } finally {
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
