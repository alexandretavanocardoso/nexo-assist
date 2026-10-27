import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { employees } from "@/server/db/schema";

export type Employee = typeof employees.$inferSelect;

export function findEmployeeByEmail(db: Db, email: string): Employee | undefined {
  return db.select().from(employees).where(eq(employees.email, email.trim().toLowerCase())).get();
}

export function findEmployeeById(db: Db, id: string): Employee | undefined {
  return db.select().from(employees).where(eq(employees.id, id)).get();
}

export function listEmployees(db: Db): Employee[] {
  return db.select().from(employees).all();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}
