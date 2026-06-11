"use client";

/**
 * Top bar para vistas del supervisor en mobile/tablet.
 *
 * Solo se muestra cuando la Sidebar está oculta (< lg / < 1024px).
 * Incluye: brand, navegación entre vistas, avatar y botón de logout.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { cn, getInitials } from "@/lib/utils";
import { Logo } from "./Logo";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mapa", label: "Mapa" },
  { href: "/guardias", label: "Guardias" },
  { href: "/alertas", label: "Alertas" },
];

interface SupervisorTopBarProps {
  userName: string;
  role: "SUPERVISOR" | "ADMIN" | "GUARDIA";
}

export function SupervisorTopBar({ userName, role }: SupervisorTopBarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 lg:hidden">
      {/* Fila superior: brand sobre fondo oscuro */}
      <div className="flex items-center justify-between gap-2 bg-brand-dark-950 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Logo size="sm" priority />
          <div className="leading-tight min-w-0">
            <p className="truncate text-sm font-bold">Scorpions D.L.</p>
            <p className="text-[10px] uppercase tracking-wider text-accent-400">
              {role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-400 text-xs font-bold text-brand-dark-950"
            title={userName}
          >
            {getInitials(userName)}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 hover:text-danger-200"
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Fila inferior: navegación entre vistas (scroll horizontal si no caben) */}
      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-2 py-1.5 shadow-sm">
        {ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
