// Sessão em cookie httpOnly assinado com HMAC (sem dependências). O cookie guarda só o id
// do usuário e a validade; o papel (funcionário/analista) sempre vem do banco.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { findEmployeeById, type Employee } from "@/services/employees";

export const SESSION_COOKIE = "nexo_session";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type SessionPayload = { userId: string; exp: number };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value !== "troque-este-segredo-em-producao") return value;
  if (process.env.NODE_ENV === "production") throw new Error("Defina SESSION_SECRET em produção.");
  return "segredo-de-desenvolvimento";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(token: string, now = Date.now()): SessionPayload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    return typeof payload.userId === "string" && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, remember: boolean): Promise<void> {
  const ttl = remember ? REMEMBER_TTL_MS : DEFAULT_TTL_MS;
  (await cookies()).set(SESSION_COOKIE, encodeSession({ userId, exp: Date.now() + ttl }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: ttl / 1000 } : {}),
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Usuário logado ou null. */
export async function getCurrentUser(): Promise<Employee | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? decodeSession(token) : null;
  return session ? (findEmployeeById(getDb(), session.userId) ?? null) : null;
}
