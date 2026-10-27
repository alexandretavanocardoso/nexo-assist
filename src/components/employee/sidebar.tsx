"use client";

import { LogOut, MessageSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NexoMark } from "@/components/ui/nexo-mark";
import { cn } from "@/components/ui/status";
import { useLogout } from "@/components/use-logout";

const NAV = [
  { href: "/atendimento", label: "Atendimento", icon: MessageSquare },
  { href: "/perfil", label: "Meu perfil", icon: UserRound },
];

export function Sidebar({ user }: { user: { name: string; email: string; initials: string } }) {
  const pathname = usePathname();
  const logout = useLogout(useRouter());

  return (
    <aside className="border-rule hidden w-[232px] shrink-0 flex-col border-r px-3.5 pt-5 pb-3.5 md:flex">
      <div className="flex items-center gap-2.5 px-2">
        <NexoMark size={20} />
        <span className="text-ink text-base font-bold">Nexo Assist</span>
      </div>
      <nav className="mt-[22px] flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px]",
                active ? "bg-primary-soft text-primary-text font-semibold" : "text-ink-2 hover:bg-desk font-medium",
              )}
            >
              <Icon size={16} className={active ? "text-primary-text" : "text-ink-3"} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div className="border-rule flex items-center gap-2.5 border-t px-2 pt-3.5 pb-1">
        <span className="bg-primary-soft text-primary-text flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold">
          {user.initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-ink truncate text-[13.5px] font-semibold">{user.name}</span>
          <span className="text-ink-3 truncate text-[11.5px]">{user.email}</span>
        </span>
      </div>
      <button
        onClick={logout}
        className="text-ink-2 hover:bg-desk flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium"
      >
        <LogOut size={16} className="text-ink-3" />
        Sair
      </button>
    </aside>
  );
}
