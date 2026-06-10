/**
 * Layout para vistas del Supervisor.
 *
 * Desktop-friendly: sidebar + área principal amplia.
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/shared/Sidebar";
import { SupervisorTopBar } from "@/components/shared/SupervisorTopBar";

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/");
  if (session.user.rol === "GUARDIA") redirect("/home");

  const displayName = session.user.nombre ?? session.user.email ?? "Supervisor";

  return (
    <div className="flex min-h-screen bg-gray-100 lg:flex-row">
      {/* Desktop: sidebar lateral (>=1024px) */}
      <Sidebar userName={displayName} role={session.user.rol} />

      {/* Mobile/Tablet: top bar (<1024px) — incluye nav y logout */}
      <div className="flex min-w-0 flex-1 flex-col">
        <SupervisorTopBar userName={displayName} role={session.user.rol} />

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
