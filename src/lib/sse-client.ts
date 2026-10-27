import type { StreamEvent } from "./stream-events";

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

async function errorMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return data?.error?.message ?? "Não foi possível falar com o servidor.";
}

/** Faz um POST e lê a resposta em Server-Sent Events, chamando onEvent a cada evento. */
export async function postStream(url: string, body: unknown, onEvent: (event: StreamEvent) => void): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new RequestError(await errorMessage(response), response.status);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (raw.startsWith("data: ")) onEvent(JSON.parse(raw.slice(6)) as StreamEvent);
      boundary = buffer.indexOf("\n\n");
    }
  }
}

/** GET/POST simples em JSON com mensagem de erro amigável. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new RequestError(await errorMessage(response), response.status);
  return (await response.json()) as T;
}
