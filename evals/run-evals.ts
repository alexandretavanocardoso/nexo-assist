// Executa os cenários de avaliação contra o agent real e gera um relatório.
//   npm run evals                      todos os cenários
//   npm run evals -- --only duplicado  um cenário
//   npm run evals -- --repeat 3        repete cada cenário (mede estabilidade)
import fs from "node:fs";
import { eq } from "drizzle-orm";
import path from "node:path";
import type { Agent } from "@mastra/core/agent";
import { createNexoAgent } from "@/agent/nexo-agent";
import { MODEL_ID } from "@/agent/model";
import type { DecisionTrace } from "@/agent/trace";
import { handleEmployeeTurn } from "@/server/chat/handle-turn";
import { openDatabase } from "@/server/db/client";
import { drafts, tickets } from "@/server/db/schema";
import { SEED_TICKETS } from "@/server/db/seed-data";
import { findEmployeeById } from "@/services/employees";
import {
  findPendingDraft,
  getOrCreateActiveConversation,
  toConversationView,
} from "@/services/conversations/conversation-service";
import type { ConversationView, DraftPayload } from "@/services/conversations/types";
import { LegacyGateway } from "@/services/tickets/legacy-gateway";
import { TicketService } from "@/services/tickets/ticket-service";
import { SCENARIOS, type Scenario } from "./scenarios";

type Check = { name: string; pass: boolean; detail?: string };
type ScenarioResult = {
  id: string;
  title: string;
  run: number;
  pass: boolean;
  checks: Check[];
  costUsd: number;
  latencyMs: number;
  transcript: Array<{
    role: string;
    text: string;
    intent?: string | null;
    confidence?: number | null;
    tools?: string[];
  }>;
  error?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    only: value("--only"),
    repeat: Number(value("--repeat") ?? 1),
    concurrency: Number(value("--concurrency") ?? 3),
  };
}

export async function runScenario(
  scenario: Scenario,
  run: number,
  makeAgent: () => Agent = () => createNexoAgent(),
): Promise<ScenarioResult> {
  const db = openDatabase(":memory:");
  const gateway = new LegacyGateway({ outageRate: 0, outageMs: 0, latencyMs: 0 });
  if (scenario.outageMs) gateway.forceOutage(scenario.outageMs);
  const ticketService = new TicketService(db, gateway);
  const agent = makeAgent();
  const employee = findEmployeeById(db, scenario.employeeId);
  if (!employee) throw new Error(`Funcionário ${scenario.employeeId} não existe nos dados de exemplo.`);
  const deps = { db, tickets: ticketService, getAgent: () => agent, retryBaseDelayMs: 200 };
  const countTickets = () => db.select().from(tickets).where(eq(tickets.requesterId, employee.id)).all().length;
  const ticketsBefore = countTickets();

  const notes: string[] = [];
  for (const turn of scenario.turns) {
    const conversation = getOrCreateActiveConversation(db, employee.id, new Date());
    if ("confirmDraft" in turn) {
      const pending = findPendingDraft(db, conversation.id);
      if (!pending) {
        notes.push("sem rascunho pendente para confirmar");
        continue;
      }
      await handleEmployeeTurn(deps, employee, { kind: "confirm-draft", draftId: pending.id }, () => {});
    } else {
      await handleEmployeeTurn(deps, employee, { kind: "message", text: turn.user }, () => {});
    }
  }

  const view = toConversationView(db, getOrCreateActiveConversation(db, employee.id, new Date()));
  const allDrafts = db
    .select()
    .from(drafts)
    .all()
    .map((d) => d.payload);
  const ticketsAfter = countTickets();
  const checks = evaluate(scenario, view, allDrafts, ticketsAfter - ticketsBefore, employee.id);
  if (notes.length) checks.push({ name: "observações", pass: true, detail: notes.join("; ") });

  const traces = view.messages.flatMap((m) => (m.trace?.source === "agent" ? [m.trace] : []));
  return {
    id: scenario.id,
    title: scenario.title,
    run,
    pass: checks.every((c) => c.pass),
    checks,
    costUsd: traces.reduce((sum, t) => sum + t.metrics.costUsd, 0),
    latencyMs: traces.reduce((sum, t) => sum + t.metrics.latencyMs, 0),
    transcript: view.messages.map((m) => ({
      role: m.role,
      text: m.text,
      intent: m.trace?.intent,
      confidence: m.trace?.confidence,
      tools: m.trace?.steps.map((s) => s.tool),
    })),
  };
}

function evaluate(
  scenario: Scenario,
  view: ConversationView,
  allDrafts: DraftPayload[],
  created: number,
  employeeId: string,
): Check[] {
  const expect = scenario.expect;
  const answers = view.messages.filter((m) => m.role === "assistant");
  const agentTraces = answers.flatMap((m): DecisionTrace[] => (m.trace?.source === "agent" ? [m.trace] : []));
  const tools = new Set(agentTraces.flatMap((t) => t.steps.map((s) => s.tool)));
  const text = answers.map((m) => m.text).join("\n");
  const checks: Check[] = [];
  const check = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });

  // Verificações que valem para todo cenário.
  check(
    "decisão registrada em toda resposta do agent",
    agentTraces.every((t) => t.intent !== null && t.confidence !== null),
    `${agentTraces.filter((t) => t.intent === null).length} resposta(s) sem decisão`,
  );
  const othersTickets = SEED_TICKETS.filter((t) => t.requesterId !== employeeId);
  const visible = JSON.stringify(answers.map((m) => ({ text: m.text, blocks: m.blocks, trace: m.trace })));
  const leaked = othersTickets.filter((t) => visible.includes(t.title) || visible.includes(t.number));
  check("nenhum dado de chamado de outra pessoa exposto", leaked.length === 0, leaked.map((t) => t.number).join(", "));

  if (expect.firstIntent) {
    const intent = agentTraces[0]?.intent ?? null;
    check(
      `intenção inicial ∈ {${expect.firstIntent.join(", ")}}`,
      intent !== null && expect.firstIntent.includes(intent),
      `registrada: ${intent}`,
    );
  }
  for (const tool of expect.toolsCalled ?? [])
    check(`usou ${tool}`, tools.has(tool), `ferramentas: ${[...tools].join(", ")}`);
  for (const tool of expect.toolsNotCalled ?? []) check(`não usou ${tool}`, !tools.has(tool));
  if (expect.draft) {
    const wanted = expect.draft;
    const match = allDrafts.find(
      (d) =>
        d.kind === wanted.kind &&
        (!wanted.ticketNumber || ("ticketNumber" in d && d.ticketNumber === wanted.ticketNumber)) &&
        (!wanted.priority || (d.kind === "create" && d.priority === wanted.priority)) &&
        (!wanted.category || (d.kind === "create" && d.category === wanted.category)) &&
        (!wanted.type || (d.kind === "create" && d.type === wanted.type)),
    );
    check(
      `rascunho ${JSON.stringify(wanted)}`,
      Boolean(match),
      `rascunhos: ${JSON.stringify(allDrafts.map(summarizeDraft))}`,
    );
  }
  for (const kind of expect.noDraftKinds ?? []) {
    check(`nenhum rascunho do tipo ${kind}`, !allDrafts.some((d) => d.kind === kind));
  }
  if (expect.ticketCard) {
    const wanted = expect.ticketCard;
    const card = answers
      .flatMap((m) => m.blocks)
      .find((b) => b.type === "ticket-card" && b.ticket.number === wanted.number);
    const overdueOk =
      card?.type === "ticket-card" && (wanted.overdue === undefined || card.ticket.overdue === wanted.overdue);
    check(`mostrou o cartão do ${wanted.number}${wanted.overdue ? " (vencido)" : ""}`, Boolean(card) && overdueOk);
  }
  if (expect.ticketsCreated !== undefined) {
    check(`chamados criados = ${expect.ticketsCreated}`, created === expect.ticketsCreated, `criados: ${created}`);
  }
  if (expect.finalStatus)
    check(`estado final = ${expect.finalStatus}`, view.status === expect.finalStatus, `estado: ${view.status}`);
  if (expect.handoffLevel) {
    check(
      `transferido para ${expect.handoffLevel}`,
      view.handoff?.level === expect.handoffLevel,
      `nível: ${view.handoff?.level}`,
    );
  }
  for (const pattern of expect.textIncludes ?? []) check(`resposta menciona ${pattern}`, pattern.test(text));
  for (const pattern of expect.textExcludes ?? []) check(`resposta não menciona ${pattern}`, !pattern.test(text));
  if (expect.retried) {
    const retried = agentTraces.some((t) => t.steps.some((s) => s.attempts > 1));
    check("tentou de novo no sistema de chamados", retried);
  }
  return checks;
}

function summarizeDraft(d: DraftPayload) {
  return d.kind === "create"
    ? { kind: d.kind, priority: d.priority, category: d.category, type: d.type }
    : { kind: d.kind, ticket: d.ticketNumber };
}

async function runAll() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Defina ANTHROPIC_API_KEY no .env para rodar os evals (eles chamam o modelo de verdade).");
    process.exit(1);
  }
  process.env.LOG_LEVEL ??= "error"; // só erros no terminal durante os evals
  const { only, repeat, concurrency } = parseArgs();
  const selected = SCENARIOS.filter((s) => !only || s.id === only);
  const jobs = selected.flatMap((scenario) => Array.from({ length: repeat }, (_, i) => ({ scenario, run: i + 1 })));
  console.log(`Rodando ${jobs.length} execução(ões) de ${selected.length} cenário(s) com ${MODEL_ID}…\n`);

  const results: ScenarioResult[] = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) return;
      const started = Date.now();
      try {
        const result = await runScenario(job.scenario, job.run);
        results.push(result);
        console.log(
          `${result.pass ? "✅" : "❌"} ${job.scenario.id} (#${job.run}) · ${((Date.now() - started) / 1000).toFixed(1)} s`,
        );
        for (const failed of result.checks.filter((c) => !c.pass))
          console.log(`     ✗ ${failed.name}${failed.detail ? ` — ${failed.detail}` : ""}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          id: job.scenario.id,
          title: job.scenario.title,
          run: job.run,
          pass: false,
          checks: [],
          costUsd: 0,
          latencyMs: 0,
          transcript: [],
          error: message,
        });
        console.log(`💥 ${job.scenario.id} (#${job.run}): ${message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  const passed = results.filter((r) => r.pass).length;
  const checks = results.flatMap((r) => r.checks);
  const cost = results.reduce((sum, r) => sum + r.costUsd, 0);
  const summary = {
    model: MODEL_ID,
    date: new Date().toISOString(),
    scenarios: `${passed}/${results.length}`,
    checks: `${checks.filter((c) => c.pass).length}/${checks.length}`,
    totalCostUsd: Number(cost.toFixed(5)),
  };
  console.log(
    `\nCenários aprovados: ${summary.scenarios} · verificações: ${summary.checks} · custo total: US$ ${cost.toFixed(4)}`,
  );

  const dir = path.join(process.cwd(), "evals", "results");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify({ summary, results }, null, 2));
  console.log("Relatório completo (com transcrições): evals/results/latest.json");
  process.exit(passed === results.length ? 0 : 1);
}

// Só executa quando chamado pela linha de comando (permite importar runScenario em testes).
if (process.argv[1]?.includes("run-evals")) void runAll();
