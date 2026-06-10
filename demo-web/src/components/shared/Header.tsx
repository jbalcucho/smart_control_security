"use client";

/**
 * Header superior (vista mobile del guardia).
 * Muestra avatar + nombre + botón de logout.
 */

import { signOut } from "next-auth/react";

import { getInitials } from "@/lib/utils";

interface HeaderProps {
  userName: string;
  role: "GUARDIA" | "SUPERVISOR" | "ADMIN";
}

export function Header({ userName, role }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="container-mobile flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            {getInitials(userName)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{role}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-xs text-gray-500 hover:text-danger-600"
          title="Cerrar sesión"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
