import { NextResponse } from "next/server";
import { z } from "zod";
import { CONSOLE_FILTERS, listConsoleConversations } from "@/server/console/console-service";
import { getDb } from "@/server/db/client";
import { requireUser, route } from "@/server/http";

const querySchema = z.object({
  filter: z.enum(CONSOLE_FILTERS).default("todas"),
  q: z.string().max(100).default(""),
});

export const GET = route(async (request: Request) => {
  const analyst = await requireUser("analyst");
  const params = new URL(request.url).searchParams;
  const { filter, q } = querySchema.parse({ filter: params.get("filter") ?? undefined, q: params.get("q") ?? undefined });
  return NextResponse.json(listConsoleConversations(getDb(), analyst, filter, q, new Date()));
});
