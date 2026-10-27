import { redirect } from "next/navigation";
import { Sidebar } from "@/components/employee/sidebar";
import { getCurrentUser } from "@/server/auth/session";
import { initials } from "@/services/employees";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "employee") redirect("/console");

  return (
    <div className="bg-paper flex h-screen overflow-hidden">
      <Sidebar user={{ name: user.name, email: user.email, initials: initials(user.name) }} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
