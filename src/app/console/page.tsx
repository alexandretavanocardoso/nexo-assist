import { redirect } from "next/navigation";
import { ConsoleApp } from "@/components/console/console-app";
import { getCurrentUser } from "@/server/auth/session";
import { listConsoleConversations } from "@/server/console/console-service";
import { getDb } from "@/server/db/client";
import { initials } from "@/services/employees";

export default async function ConsolePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "analyst") redirect("/atendimento");

  const list = listConsoleConversations(getDb(), user, "todas", "", new Date());
  const { c } = await searchParams;
  return (
    <ConsoleApp
      analyst={{ id: user.id, name: user.name, initials: initials(user.name), level: user.supportLevel }}
      initialList={list}
      initialSelectedId={c ?? list.items.find((item) => item.status === "waiting_human")?.id ?? null}
    />
  );
}
