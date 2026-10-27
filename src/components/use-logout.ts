"use client";

import type { useRouter } from "next/navigation";

export function useLogout(router: ReturnType<typeof useRouter>) {
  return async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };
}
