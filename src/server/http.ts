// Utilitários das rotas HTTP: autenticação por papel, validação com Zod e erros padronizados.
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import type { Role } from "@/domain/types";
import { getCurrentUser } from "@/server/auth/session";
import { logger } from "@/server/logger";
import type { Employee } from "@/services/employees";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requireUser(role: Role): Promise<Employee> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "unauthenticated", "Faça login para continuar.");
  if (user.role !== role) throw new HttpError(403, "forbidden", "Seu perfil não tem acesso a esta área.");
  return user;
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Corpo da requisição inválido.");
  }
  return schema.parse(json);
}

/** Envolve uma rota: converte erros conhecidos em JSON e registra os inesperados. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "invalid_input", message: "Dados inválidos.", issues: error.issues } },
          { status: 400 },
        );
      }
      logger.error("http.unhandled_error", { error });
      return NextResponse.json({ error: { code: "internal", message: "Erro inesperado." } }, { status: 500 });
    }
  };
}
