"use client";

// Transparência: mostra o que o agent entendeu, que ação tomou, com que confiança, por quê,
// quais regras do service desk aplicou e cada etapa (entrada/saída) — lido do decision trace salvo.
import { Bot, Check, ChevronRight, Cpu, ServerCog, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { INTENT_LABELS, rulesOf, type DecisionTrace, type TraceStep } from "@/agent/trace";
import { cn } from "@/components/ui/status";

function confidenceLevel(value: number): { label: string; bar: string; text: string } {
  if (value >= 0.8) return { label: "alta", bar: "bg-success", text: "text-success-text" };
  if (value >= 0.5) return { label: "média", bar: "bg-warning", text: "text-warning-text" };
  return { label: "baixa", bar: "bg-danger", text: "text-danger-text" };
}

export function ConfidenceBar({ value }: { value: number }) {
  const level = confidenceLevel(value);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="bg-ink/10 h-1.5 w-24 overflow-hidden rounded-full">
        <span className={cn("block h-full rounded-full", level.bar)} style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className={cn("text-[12.5px] font-semibold", level.text)}>
        {Math.round(value * 100)}% · {level.label}
      </span>
    </span>
  );
}

const usd = (value: number) => `US$ ${value.toFixed(value < 0.01 ? 5 : 3).replace(".", ",")}`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const thousands = (value: number) => value.toLocaleString("pt-BR");

export function DecisionPanel({ trace }: { trace: DecisionTrace }) {
  const rules = rulesOf(trace);
  const fromServer = trace.source === "server";
  // registrar_decisao já aparece nos campos acima; o passo a passo mostra as ações.
  const steps = trace.steps.filter((step) => step.tool !== "registrar_decisao");

  return (
    <div className="border-rule bg-desk/60 text-ink-2 flex flex-col gap-3 rounded-xl border p-4 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-semibold",
            fromServer ? "bg-violet-soft text-violet-text" : "bg-primary-soft text-primary-text",
          )}
        >
          {fromServer ? <ServerCog size={13} /> : <Bot size={13} />}
          {fromServer ? "Ação do sistema (sem IA)" : "Decisão do agent"}
        </span>
        {trace.intent && (
          <span className="bg-paper text-ink ring-rule rounded-md px-2 py-0.5 text-[12px] font-medium ring-1">
            {INTENT_LABELS[trace.intent]}
          </span>
        )}
      </div>

      <Field label="O que entendeu">{trace.understood ?? <Missing />}</Field>
      <Field label="Ação">{trace.action ?? <Missing />}</Field>
      <Field label="Confiança">
        {trace.confidence !== null ? <ConfidenceBar value={trace.confidence} /> : <Missing />}
      </Field>
      <Field label="Por quê">{trace.rationale ?? <Missing />}</Field>

      {rules.length > 0 && (
        <Field label="Regras aplicadas">
          <ul className="flex flex-col gap-1">
            {rules.map((rule) => (
              <li key={rule} className="flex gap-1.5">
                <Check size={13} className="text-success-text mt-0.5 shrink-0" />
                {rule}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {steps.length > 0 && (
        <Field label="Passo a passo">
          <ol className="flex flex-col gap-1">
            {steps.map((step, index) => (
              <StepRow key={step.id} step={step} index={index + 1} />
            ))}
          </ol>
        </Field>
      )}

      {!fromServer && trace.metrics.model && (
        <p className="border-rule text-ink-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2.5 text-[12px]">
          <Cpu size={13} />
          <span className="font-mono">{trace.metrics.model}</span>
          <span>· {thousands(trace.metrics.inputTokens)} tokens de entrada</span>
          {trace.metrics.cachedInputTokens > 0 && <span>({thousands(trace.metrics.cachedInputTokens)} em cache)</span>}
          <span>· {thousands(trace.metrics.outputTokens)} de saída</span>
          <span>· {usd(trace.metrics.costUsd)}</span>
          <span>· {seconds(trace.metrics.latencyMs)}</span>
          {trace.metrics.firstTokenMs !== null && <span>(1º texto em {seconds(trace.metrics.firstTokenMs)})</span>}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 max-sm:grid-cols-1 max-sm:gap-1">
      <span className="text-ink-3 text-[12px] font-semibold tracking-wide uppercase">{label}</span>
      <div className="text-ink min-w-0">{children}</div>
    </div>
  );
}

function Missing() {
  return <span className="text-ink-3">não registrado</span>;
}

const STEP_TITLES: Record<string, string> = { oferecer_opcoes: "mostrou opções de resposta" };

function StepRow({ step, index }: { step: TraceStep; index: number }) {
  const [open, setOpen] = useState(false);
  const label =
    step.labels.length > 0 ? step.labels.join(" · ") : (STEP_TITLES[step.tool] ?? step.tool.replace(/_/g, " "));
  return (
    <li className="bg-paper ring-rule rounded-lg ring-1">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        <ChevronRight size={13} className={cn("text-ink-3 shrink-0 transition", open && "rotate-90")} />
        <span className="text-ink-3">{index}.</span>
        {step.status === "ok" ? (
          <Check size={13} className="text-success-text shrink-0" />
        ) : (
          <TriangleAlert size={13} className="text-warning-text shrink-0" />
        )}
        <span className="flex-1 truncate">{label}</span>
        <span className="text-ink-3 hidden font-mono text-[11.5px] sm:inline">{step.tool}</span>
        <span className="text-ink-3 text-[11.5px]">{step.durationMs} ms</span>
        {step.attempts > 1 && (
          <span className="bg-warning-soft text-warning-text rounded px-1.5 text-[11.5px] font-medium">
            {step.attempts} tentativas
          </span>
        )}
      </button>
      {open && (
        <div className="border-rule grid gap-2 border-t p-2.5 md:grid-cols-2">
          <JsonBox title="Entrada" value={step.input} />
          <JsonBox title="Saída" value={step.output} />
        </div>
      )}
    </li>
  );
}

function JsonBox({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="text-ink-3 mb-1 text-[11.5px] font-semibold">{title}</p>
      <pre className="bg-desk text-ink-2 max-h-60 scrollbar-thin overflow-auto rounded-md p-2 font-mono text-[11.5px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
