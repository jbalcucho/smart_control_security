/**
 * Pantalla principal del Guardia.
 *
 * Muestra:
 *   - Saludo + puesto asignado + turno + hora actual
 *   - Banner de estado actual: FUERA_DE_TURNO / EN_TURNO / EN_REFRIGERIO
 *   - Acciones contextuales según el estado (no se muestran botones imposibles):
 *       FUERA_DE_TURNO → "Marcar entrada"
 *       EN_TURNO       → "Marcar salida" + "Salir a refrigerio"
 *       EN_REFRIGERIO  → "Regresar de refrigerio"
 *   - Acceso al reporte de jornada del guardia (refrigerios + horas efectivas)
 *   - Reportar novedad + Botón de pánico (siempre disponibles)
 */

import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenerEstadoGuardia } from "@/lib/estado-guardia";
import { formatTime } from "@/lib/utils";
import { formatDuration, formatHourMinute } from "@/lib/reporte-jornada";
import { BotonPanico } from "@/components/guardia/BotonPanico";
import { BotonRefrigerio } from "@/components/guardia/BotonRefrigerio";

export default async function HomeGuardiaPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [user, { estado, ultimaMarca }] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { puesto: true },
    }),
    obtenerEstadoGuardia(session.user.id),
  ]);

  if (!user) return null;

  const now = new Date();

  const tiempoEnRefrigerioMs =
    estado === "EN_REFRIGERIO" && ultimaMarca
      ? now.getTime() - ultimaMarca.timestampServidor.getTime()
      : null;

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

      {/* Estado actual */}
      <EstadoBanner
        estado={estado}
        desde={ultimaMarca?.timestampServidor ?? null}
        tiempoEnRefrigerioMs={tiempoEnRefrigerioMs}
      />

      {/* Hora actual */}
      <section className="card text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500">Hora actual</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
          {formatTime(now)}
        </p>
      </section>

      {/* Acciones contextuales según el estado */}
      {user.puesto && (
        <Acciones
          estado={estado}
          puestoLat={user.puesto.latitud}
          puestoLng={user.puesto.longitud}
          refrigerioDesde={
            estado === "EN_REFRIGERIO" ? ultimaMarca?.timestampServidor ?? null : null
          }
        />
      )}

      {/* Acceso al reporte de la jornada */}
      <Link
        href={`/mi-reporte`}
        className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2M5 11h14M5 11a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 01-2 2"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Mi reporte de hoy</p>
          <p className="text-xs text-gray-500">
            Refrigerios y horas efectivas trabajadas
          </p>
        </div>
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* Reportar novedad (secundario) */}
      <Link
        href="/novedad/nueva"
        className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition-colors hover:bg-gray-50 active:scale-[0.98]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-700">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="flex-1 text-left">
          <p className="text-base font-bold text-gray-900">Reportar novedad</p>
          <p className="text-xs text-gray-500">
            Incidente, solicitud de refuerzos o reporte informativo
          </p>
        </div>
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* Botón de pánico */}
      <BotonPanico />
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function EstadoBanner({
  estado,
  desde,
  tiempoEnRefrigerioMs,
}: {
  estado: "FUERA_DE_TURNO" | "EN_TURNO" | "EN_REFRIGERIO";
  desde: Date | null;
  tiempoEnRefrigerioMs: number | null;
}) {
  if (estado === "EN_REFRIGERIO" && desde && tiempoEnRefrigerioMs != null) {
    return (
      <section className="card bg-accent-50 ring-accent-400/40">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🍽️
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-wide text-accent-700">
              En refrigerio
            </p>
            <p className="mt-0.5 text-sm text-gray-700">
              Desde las <strong>{formatHourMinute(desde)}</strong> ·{" "}
              {formatDuration(tiempoEnRefrigerioMs)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (estado === "EN_TURNO" && desde) {
    return (
      <section className="card bg-primary-50 ring-primary-400/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            ✓
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
              En turno
            </p>
            <p className="mt-0.5 text-sm text-gray-700">
              Última marca a las <strong>{formatHourMinute(desde)}</strong>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          ⏸
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Sin turno abierto
          </p>
          <p className="mt-0.5 text-sm text-gray-700">
            Inicia tu turno marcando entrada cuando llegues al puesto.
          </p>
        </div>
      </div>
    </section>
  );
}

function Acciones({
  estado,
  puestoLat,
  puestoLng,
  refrigerioDesde,
}: {
  estado: "FUERA_DE_TURNO" | "EN_TURNO" | "EN_REFRIGERIO";
  puestoLat: number;
  puestoLng: number;
  refrigerioDesde: Date | null;
}) {
  if (estado === "FUERA_DE_TURNO") {
    return (
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
        <div className="text-lg font-bold">Marcar entrada</div>
        <div className="mt-1 text-sm text-white/80">Captura selfie + ubicación</div>
      </Link>
    );
  }

  if (estado === "EN_TURNO") {
    return (
      <div className="space-y-3">
        <Link
          href="/marcar"
          className="block w-full rounded-2xl bg-gray-800 px-6 py-5 text-center text-white shadow-lg transition-all hover:bg-gray-900 active:scale-[0.98]"
        >
          <div className="text-lg font-bold">Marcar salida</div>
          <div className="mt-1 text-sm text-white/80">Cierra tu turno con selfie + ubicación</div>
        </Link>
        <BotonRefrigerio
          variante="salida"
          fallbackLat={puestoLat}
          fallbackLng={puestoLng}
        />
      </div>
    );
  }

  // EN_REFRIGERIO
  return (
    <BotonRefrigerio
      variante="regreso"
      fallbackLat={puestoLat}
      fallbackLng={puestoLng}
      refrigerioDesde={refrigerioDesde}
    />
  );
}
