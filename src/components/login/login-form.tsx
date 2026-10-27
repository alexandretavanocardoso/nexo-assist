"use client";

import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { cn } from "@/components/ui/status";

type DemoAccount = { email: string; name: string; role: "employee" | "analyst" };

export function LoginForm({ demoAccounts }: { demoAccounts: DemoAccount[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = (await response.json()) as { redirectTo?: string; error?: { message: string } };
      if (!response.ok || !data.redirectTo) throw new Error(data.error?.message ?? "Não foi possível entrar.");
      router.replace(data.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-[380px] max-w-full flex-col gap-7" noValidate>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-ink text-[40px] leading-tight">Entrar</h2>
        <p className="text-ink-3 text-[15.5px]">Use seu e-mail corporativo e a senha da rede Nexo.</p>
      </div>

      <div className="flex flex-col gap-[18px]">
        <label className="flex flex-col gap-2">
          <span className="text-ink text-[13.5px] font-medium">E-mail corporativo</span>
          <span className="border-line bg-paper focus-within:border-cta flex h-11 items-center gap-2.5 rounded-lg border pr-2 pl-3.5">
            <Mail size={16} className="text-ink-3" />
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.sobrenome@nexo.com.br"
              className="text-ink placeholder:text-ink-3/70 w-full bg-transparent text-[14.5px] outline-none"
            />
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between">
            <span className="text-ink text-[13.5px] font-medium">Senha</span>
            <span
              className="text-primary-text text-[13.5px] font-medium"
              title="Na demonstração qualquer senha funciona."
            >
              Esqueci minha senha
            </span>
          </span>
          <span className="border-line bg-paper focus-within:border-cta flex h-11 items-center gap-2.5 rounded-lg border pr-2 pl-3.5">
            <LockKeyhole size={16} className="text-ink-3" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="text-ink placeholder:text-ink-3/70 w-full bg-transparent text-[14.5px] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-ink-3 hover:bg-desk flex size-[30px] items-center justify-center rounded-md"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 pt-0.5">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="peer sr-only"
          />
          <span className="border-line bg-paper peer-checked:border-cta peer-checked:bg-cta peer-focus-visible:ring-cta/30 flex size-[18px] items-center justify-center rounded-md border peer-focus-visible:ring-2">
            {remember && <Check size={12} className="text-white" />}
          </span>
          <span className="text-ink-2 text-[13.5px]">Manter conectado neste computador</span>
        </label>
      </div>

      {error && (
        <p role="alert" className="bg-danger-soft text-danger-text rounded-lg px-3 py-2 text-[13.5px]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="bg-cta hover:bg-cta-hover flex h-11 items-center justify-center gap-2 rounded-lg text-[15.5px] font-semibold text-white transition disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar"}
        {!loading && <ArrowRight size={16} />}
      </button>

      <div className="border-rule flex flex-col gap-2 border-t pt-4">
        <p className="text-ink-3 text-[12.5px]">Contas de demonstração (qualquer senha):</p>
        <div className="flex flex-wrap gap-1.5">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword((p) => p || "demo");
              }}
              className={cn(
                "border-rule text-ink-2 hover:border-cta hover:text-cta rounded-full border px-2.5 py-1 text-[12.5px]",
                email === account.email && "border-cta text-cta",
              )}
            >
              {account.name} · {account.role === "analyst" ? "analista" : "funcionário"}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
