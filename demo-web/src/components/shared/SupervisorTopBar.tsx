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

const ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mapa", label: "Mapa" },
  { href: "/alertas", label: "Alertas" },
];

interface SupervisorTopBarProps {
  userName: string;
  role: "SUPERVISOR" | "ADMIN" | "GUARDIA";
}

export function SupervisorTopBar({ userName, role }: SupervisorTopBarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur lg:hidden">
      {/* Fila superior: brand + usuario + logout */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900">SCS</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              {role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700"
            title={userName}
          >
            {getInitials(userName)}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-300 transition-colors hover:bg-gray-100 hover:text-danger-600"
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Fila inferior: navegación entre vistas (scroll horizontal si no caben) */}
      <nav className="flex gap-1 overflow-x-auto border-t border-gray-100 px-2 py-1.5">
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
