/**
 * Pantalla principal del Guardia.
 *
 * Muestra: nombre, puesto asignado, turno, botón grande "Marcar".
 *
 * Estado: PLACEHOLDER inicial — se implementará completo en Sprint Demo 1.
 */

import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTime } from "@/lib/utils";

export default async function HomeGuardiaPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { puesto: true },
  });

  if (!user) return null;

  const now = new Date();

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Saludo */}
      <section className="card">
        <p className="text-sm text-gray-500">Bienvenido</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{user.nombre}</h1>
      </section>

      {/* Puesto asignado */}
      {user.puesto ? (
        <section className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Puesto asignado</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{user.puesto.nombre}</h2>
          <p className="mt-1 text-sm text-gray-600">{user.puesto.direccion}</p>

          {user.turnoNombre && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm">
              <svg
                className="h-4 w-4 text-primary-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-gray-700">
                Turno <strong>{user.turnoNombre}</strong>: {user.turnoInicio}–{user.turnoFin}
              </span>
            </div>
          )}
        </section>
      ) : (
        <section className="card bg-warning-50 ring-warning-500/30">
          <p className="text-sm text-warning-700">
            Aún no tienes un puesto asignado. Contacta a tu supervisor.
          </p>
        </section>
      )}

      {/* Hora actual */}
      <section className="card text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500">Hora actual</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
          {formatTime(now)}
        </p>
      </section>

      {/* Botón principal: Marcar */}
      <Link
        href="/marcar"
        className="block w-full rounded-2xl bg-primary-600 px-6 py-6 text-center text-white shadow-lg transition-all hover:bg-primary-700 active:scale-[0.98]"
      >
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div className="text-lg font-bold">Marcar asistencia</div>
        <div className="mt-1 text-sm text-white/80">Captura selfie + ubicación</div>
      </Link>
    </div>
  );
}
