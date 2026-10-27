import { randomUUID } from "node:crypto";
import { calculateDueDate } from "@/domain/sla";
import type { Db } from "./client";
import { conversations, employees, messages, ticketEvents, tickets } from "./schema";
import { SEED_CONVERSATIONS, SEED_EMPLOYEES, SEED_TICKETS, type RelativeTime } from "./seed-data";

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

/** Converte um tempo relativo do seed em data absoluta. */
export function resolveTime(time: RelativeTime, now: Date): Date {
  if (time.minutesAgo !== undefined) return new Date(now.getTime() - time.minutesAgo * 60 * 1000);
  const local = new Date(now.getTime() + BRT_OFFSET_MS);
  local.setUTCDate(local.getUTCDate() - (time.daysAgo ?? 0));
  if (time.at) {
    const [hours, minutes] = time.at.split(":").map(Number);
    local.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0);
  }
  return new Date(local.getTime() - BRT_OFFSET_MS);
}

/** Popula o banco com os dados de exemplo, se ainda estiver vazio. Retorna true se populou. */
export function seedDatabase(db: Db, now: Date): boolean {
  if (db.select({ id: employees.id }).from(employees).limit(1).all().length > 0) return false;

  db.transaction((tx) => {
    tx.insert(employees).values(SEED_EMPLOYEES).run();

    for (const seed of SEED_TICKETS) {
      const id = `t-${seed.number}`;
      const createdAt = resolveTime(seed.createdAt, now);
      const lastServiceUpdateAt = resolveTime(seed.lastServiceUpdateAt, now);
      tx.insert(tickets)
        .values({
          id,
          number: seed.number,
          type: seed.type,
          title: seed.title,
          description: seed.description,
          category: seed.category,
          priority: seed.priority,
          impact: seed.impact,
          urgency: seed.urgency,
          status: seed.status,
          requesterId: seed.requesterId,
          assignedLevel: seed.assignedLevel,
          createdAt,
          lastServiceUpdateAt,
          updatedAt: lastServiceUpdateAt,
          resolvedAt: seed.resolvedAt ? resolveTime(seed.resolvedAt, now) : null,
        })
        .run();
      for (const event of seed.events) {
        tx.insert(ticketEvents)
          .values({ id: randomUUID(), ticketId: id, kind: event.kind, author: event.author, text: event.text, createdAt: resolveTime(event.at, now) })
          .run();
      }
    }

    for (const seed of SEED_CONVERSATIONS) {
      const conversationId = randomUUID();
      const times = seed.messages.map((m) => resolveTime(m.at, now));
      const first = times[0] ?? now;
      const last = times[times.length - 1] ?? now;
      const handoffAt = seed.handoff ? resolveTime(seed.handoff.at, now) : null;
      tx.insert(conversations)
        .values({
          id: conversationId,
          employeeId: seed.employeeId,
          status: seed.status,
          assignedAnalystId: null,
          closedReason: seed.closedReason ?? null,
          handoff:
            seed.handoff && handoffAt
              ? {
                  reason: seed.handoff.reason,
                  summary: seed.handoff.summary,
                  ticketNumber: seed.handoff.ticketNumber,
                  level: seed.handoff.level,
                  priority: seed.handoff.priority,
                  confidence: seed.handoff.confidence,
                  transferredAt: handoffAt.toISOString(),
                  contactDueAt: calculateDueDate(seed.handoff.priority, handoffAt).toISOString(),
                }
              : null,
          userMessageCount: seed.messages.filter((m) => m.role === "user").length,
          createdAt: first,
          updatedAt: last,
          lastMessageAt: last,
        })
        .run();
      seed.messages.forEach((message, index) => {
        tx.insert(messages)
          .values({
            id: randomUUID(),
            conversationId,
            role: message.role,
            authorId: message.role === "user" ? seed.employeeId : null,
            text: message.text,
            blocks: [],
            trace: null,
            confidence: message.confidence ?? null,
            createdAt: times[index] ?? now,
          })
          .run();
      });
    }
  });
  return true;
}
