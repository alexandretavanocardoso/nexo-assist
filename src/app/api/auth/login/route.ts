import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { HttpError, parseBody, route } from "@/server/http";
import { logger } from "@/server/logger";
import { findEmployeeByEmail } from "@/services/employees";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Ambiente de demonstração: qualquer senha é aceita para os usuários dos dados de exemplo.
  password: z.string().min(1),
  remember: z.boolean().default(false),
});

export const POST = route(async (request: Request) => {
  const { email, remember } = await parseBody(request, loginSchema);
  const user = findEmployeeByEmail(getDb(), email);
  if (!user)
    throw new HttpError(401, "invalid_credentials", "E-mail não encontrado. Use um e-mail corporativo da Nexo.");
  await createSession(user.id, remember);
  logger.info("auth.login", { userId: user.id, role: user.role });
  return NextResponse.json({ redirectTo: user.role === "analyst" ? "/console" : "/atendimento" });
});
