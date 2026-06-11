/**
 * Reporte de jornada de un guardia (vista del supervisor).
 *
 * Server Component que recibe ?fecha=YYYY-MM-DD para filtrar el día.
 * Default: hoy.
 *
 * Solo accesible para SUPERVISOR/ADMIN (el layout (supervisor) ya bloquea
 * el rol GUARDIA, pero hacemos doble check).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calcularReporte,
  type Jornada,
  type MarcaSimple,
  type Refrigerio,
  type ReporteJornada,
} from "@/lib/reporte-jornada";
import { ReporteJornadaView } from "@/components/shared/ReporteJornadaView";

function serializeReporte(r: ReporteJornada) {
  return {
    ...r,
    generadoEn: r.generadoEn.toISOString(),
    desde: r.desde.toISOString(),
    hasta: r.hasta.toISOString(),
    jornadas: r.jornadas.map((j: Jornada) => ({
      ...j,
      inicio: j.inicio.toISOString(),
      fin: j.fin.toISOString(),
      refrigerios: j.refrigerios.map((rf: Refrigerio) => ({
        ...rf,
        salida: rf.salida.toISOString(),
        entrada: rf.entrada.toISOString(),
      })),
    })),
  };
}

function parsearFecha(raw?: string): { iso: string; desde: Date; hasta: Date } {
  const now = new Date();
  let ref: Date;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    ref = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(ref.getTime())) ref = now;
  } else {
    ref = now;
  }
  const desde = new Date(ref);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(ref);
  hasta.setHours(23, 59, 59, 999);
  return { iso: desde.toISOString().slice(0, 10), desde, hasta };
}

function diasAlrededor(centro: Date, n: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  for (let i = n; i >= -n; i--) {
    const d = new Date(centro);
    d.setDate(d.getDate() - i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-CO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
    });
  }
  return out;
}

export default async function ReporteGuardiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fecha?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.rol === "GUARDIA") redirect("/home");

  const { id } = await params;
  const { fecha } = await searchParams;

  const guardia = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      turnoNombre: true,
      turnoInicio: true,
      turnoFin: true,
      puesto: { select: { id: true, nombre: true, direccion: true } },
    },
  });

  if (!guardia || guardia.rol !== "GUARDIA") notFound();

  const { iso, desde, hasta } = parsearFecha(fecha);

  const marcas = await prisma.marca.findMany({
    where: {
      userId: id,
      timestampServidor: { gte: desde, lte: hasta },
    },
    orderBy: { timestampServidor: "asc" },
    select: {
      id: true,
      tipo: true,
      timestampServidor: true,
      latitud: true,
      longitud: true,
      precisionM: true,
      distanciaPuestoM: true,
      dentroDelGeofence: true,
      esFraude: true,
      fotoUrl: true,
    },
  });

  const reporte = calcularReporte(marcas as MarcaSimple[], {
    desde,
    hasta,
    ahora: new Date(),
  });

  const dias = diasAlrededor(new Date(`${iso}T12:00:00`), 3);
  const hoyIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex items-center gap-3">
        <Link
          href="/guardias"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200"
          aria-label="Volver"
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
          <h1 className="text-xl font-bold text-gray-900">Reporte de jornada</h1>
          <p className="text-xs text-gray-500">
            Refrigerios y horas efectivas — uso para auditoría / facturación
          </p>
        </div>
      </header>

      {/* Selector de día (pills navegables) */}
      <nav className="card flex flex-wrap items-center gap-2 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          Fecha:
        </span>
        {dias.map((d) => {
          const activo = d.iso === iso;
          const esHoy = d.iso === hoyIso;
          return (
            <Link
              key={d.iso}
              href={`/guardias/${id}/reporte?fecha=${d.iso}`}
              className={
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors " +
                (activo
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200")
              }
            >
              {d.label}
              {esHoy && !activo && (
                <span className="ml-1 text-[9px] text-primary-700">hoy</span>
              )}
            </Link>
          );
        })}
      </nav>

      <ReporteJornadaView
        data={{ guardia, fecha: iso, reporte: serializeReporte(reporte) }}
        mostrarPerfil
      />
    </div>
  );
}
