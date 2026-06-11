"use client";

/**
 * Sidebar para la vista desktop del supervisor.
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

interface SidebarProps {
  userName: string;
  role: "SUPERVISOR" | "ADMIN" | "GUARDIA";
}

export function Sidebar({ userName, role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
      {/* Brand header (fondo oscuro tipo placa de seguridad) */}
      <div className="flex items-center gap-3 border-b border-brand-dark-800 bg-brand-dark-950 px-4 py-3">
        <Logo size="md" priority />
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Scorpions D.L.</p>
          <p className="text-[10px] uppercase tracking-wider text-accent-400">
            Private Security
          </p>
        </div>
      </div>

      {/* Cuerpo con padding interno */}
      <div className="flex flex-1 flex-col p-4">

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-700 hover:bg-gray-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            {getInitials(userName)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        >
          Cerrar sesión
        </button>
      </div>
      </div>
    </aside>
  );
}
