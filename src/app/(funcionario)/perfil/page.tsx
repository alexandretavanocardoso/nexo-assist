import { KeyRound, Lock, Mail, RotateCcwKey } from "lucide-react";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/employee/top-bar";
import { getCurrentUser } from "@/server/auth/session";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <TopBar here="Meu perfil" />
      <main className="flex flex-1 justify-center overflow-y-auto px-6 py-10">
        <div className="flex w-[640px] max-w-full flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-ink text-[32px]">Meu perfil</h1>
            <p className="text-ink-3 text-[14.5px]">Seus dados de acesso ao service desk de TI.</p>
          </div>

          <dl className="border-rule rounded-xl border">
            <Row label="Nome" value={user.name} />
            <Row label="E-mail corporativo" value={user.email} note="Gerenciado pela TI" />
            <Row label="Área" value={user.department} />
            <Row label="Equipamento" value={user.device ?? "—"} last />
          </dl>

          <div className="border-rule overflow-hidden rounded-xl border">
            <div className="flex items-center gap-3 px-6 py-4">
              <span className="bg-desk flex size-9 items-center justify-center rounded-full">
                <KeyRound size={16} className="text-ink-2" />
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-ink text-[14.5px] font-semibold">Senha</span>
                <span className="text-ink-3 text-[12.5px]">A senha da rede expira a cada 90 dias</span>
              </div>
              <button
                disabled
                title="Indisponível na demonstração"
                className="border-line text-ink flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13.5px] font-medium disabled:opacity-60"
              >
                <RotateCcwKey size={15} />
                Redefinir senha
              </button>
            </div>
            <p className="border-rule bg-desk text-ink-3 flex items-center gap-2 border-t px-6 py-3 text-[13px]">
              <Mail size={14} />
              Enviaremos um link de redefinição para {user.email}.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, value, note, last }: { label: string; value: string; note?: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-6 py-4 ${last ? "" : "border-rule border-b"}`}>
      <dt className="text-ink-3 w-40 shrink-0 text-[13.5px]">{label}</dt>
      <dd className="text-ink flex flex-1 items-center justify-between text-[14.5px]">
        {value}
        {note && (
          <span className="text-ink-3 flex items-center gap-1.5 text-[12.5px]">
            <Lock size={13} />
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}
