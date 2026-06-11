"use client";

/**
 * Header superior (vista mobile del guardia).
 * Muestra brand + avatar + nombre + botón de logout.
 */

import { signOut } from "next-auth/react";

import { getInitials } from "@/lib/utils";
import { Logo } from "./Logo";

interface HeaderProps {
  userName: string;
  role: "GUARDIA" | "SUPERVISOR" | "ADMIN";
}

export function Header({ userName, role }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10">
      {/* Fila superior brand (fondo oscuro) */}
      <div className="bg-brand-dark-950 text-white">
        <div className="container-mobile flex items-center justify-between py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Logo size="sm" priority />
            <div className="leading-tight min-w-0">
              <p className="truncate text-sm font-bold">Scorpions D.L.</p>
              <p className="text-[10px] uppercase tracking-wider text-accent-400">
                Private Security
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 hover:bg-white/20"
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Fila inferior con usuario actual */}
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="container-mobile flex items-center gap-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-400 text-sm font-bold text-brand-dark-950 ring-2 ring-brand-dark-950/10">
            {getInitials(userName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
