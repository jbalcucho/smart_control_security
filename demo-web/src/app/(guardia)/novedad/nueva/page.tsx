/**
 * Página /novedad/nueva — formulario de reporte de novedad para el guardia.
 *
 * Server Component: resuelve la sesión + puesto del guardia y renderiza el
 * formulario cliente NovedadForm.
 */

import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NovedadForm } from "@/components/guardia/NovedadForm";

export default async function NuevaNovedadPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { puesto: true },
  });

  const puesto = user?.puesto
    ? {
        id: user.puesto.id,
        nombre: user.puesto.nombre,
        direccion: user.puesto.direccion,
      }
    : null;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link
          href="/home"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200"
          aria-label="Volver al inicio"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reportar novedad</h1>
          <p className="text-xs text-gray-500">
            ¿Una emergencia inmediata? Usa el botón de pánico desde el inicio.
          </p>
        </div>
      </header>

      <NovedadForm puesto={puesto} />
    </div>
  );
}
