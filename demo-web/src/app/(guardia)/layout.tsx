/**
 * Layout para vistas del Guardia.
 *
 * Mobile-first: container limitado a 480px, navegación bottom-tab.
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { BottomNav } from "@/components/shared/BottomNav";
import { Header } from "@/components/shared/Header";

export default async function GuardiaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/");
  if (session.user.rol !== "GUARDIA") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header
        userName={session.user.nombre ?? session.user.email ?? "Guardia"}
        role="GUARDIA"
      />

      <main className="container-mobile flex-1 pb-24 pt-4">{children}</main>

      <BottomNav />
    </div>
  );
}
