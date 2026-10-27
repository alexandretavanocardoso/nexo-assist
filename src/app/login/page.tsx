import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { NexoMark } from "@/components/ui/nexo-mark";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getLoginStats } from "@/server/stats";
import { SEED_EMPLOYEES } from "@/server/db/seed-data";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "analyst" ? "/console" : "/atendimento");
  const stats = getLoginStats(getDb());
  const demoAccounts = SEED_EMPLOYEES.filter((e) => ["e-ana", "e-bruno", "a-rafael"].includes(e.id)).map((e) => ({
    email: e.email,
    name: e.name,
    role: e.role,
  }));

  return (
    <main className="bg-paper flex min-h-screen">
      <section className="bg-ink hidden w-[800px] shrink-0 flex-col justify-between px-16 pt-10 pb-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <NexoMark size={24} color="#FFFFFF" />
          <span className="text-[17px] font-bold">Nexo Assist</span>
        </div>

        <div className="flex flex-col gap-9">
          <div className="flex flex-col gap-[18px]">
            <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
            <h1 className="font-display text-[54px] leading-[1.05]">Seu problema de TI, resolvido em uma conversa.</h1>
            <p className="max-w-[520px] text-base text-white/65">
              Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um
              analista quando precisa.
            </p>
          </div>
          <div className="pl-24">
            <div className="flex w-[500px] flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-[18px]">
              <div className="flex justify-end">
                <p className="bg-paper text-ink rounded-[12px_12px_4px_12px] px-3.5 py-2 text-[13.5px]">
                  Meu notebook não conecta na VPN. Erro 809.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="flex gap-1.5 text-[12.5px]">
                  <span className="font-semibold text-white/80">Nexo Assist</span>
                  <span className="text-white/45">consultou seus chamados · criou um chamado</span>
                </p>
                <p className="w-[380px] rounded-[4px_12px_12px_12px] bg-white/10 px-3.5 py-2.5 text-[13.5px]">
                  Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.
                </p>
                <p className="bg-paper flex w-fit items-center gap-2 rounded-xl px-3 py-[7px] text-[12.5px]">
                  <span className="bg-warning size-[7px] rounded-full" />
                  <span className="text-ink font-semibold">INC-20517</span>
                  <span className="text-ink-3">Rede e VPN · Alta · em até 4 h</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <dl className="flex border-t border-white/10 pt-6">
          <Stat value={stats.firstResponse} label="primeira resposta, em média" />
          <Stat value={stats.resolvedWithoutQueue} label="resolvidos sem fila" bordered />
          <Stat value={String(stats.analysts)} label="analistas no service desk" bordered live />
        </dl>
      </section>

      <section className="flex flex-1 flex-col justify-between px-6 py-10 sm:px-14">
        <p className="flex justify-end gap-1.5 text-[13.5px]">
          <span className="text-ink-3">Problema para entrar?</span>
          <span className="text-primary-text font-semibold">Ligue no ramal 4000</span>
        </p>
        <div className="flex justify-center">
          <LoginForm demoAccounts={demoAccounts} />
        </div>
        <footer className="text-ink-3 flex justify-between text-[12.5px]">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  );
}

function Stat({ value, label, bordered, live }: { value: string; label: string; bordered?: boolean; live?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col gap-1.5 ${bordered ? "border-l border-white/10 pl-6" : ""}`}>
      <dt className="order-2 text-[13.5px] text-white/55">{label}</dt>
      <dd className="font-display order-1 flex items-center gap-2 text-[34px] leading-none">
        {value}
        {live && <span className="bg-success size-2 rounded-full" />}
      </dd>
    </div>
  );
}
