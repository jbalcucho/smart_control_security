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
import { parseRango } from "@/lib/rango-fecha";
import {
  calcularReporte,
  type Jornada,
  type MarcaSimple,
  type Refrigerio,
  type ReporteJornada,
} from "@/lib/reporte-jornada";
import {
  ReporteJornadaView,
  type MarcaSerialized,
} from "@/components/shared/ReporteJornadaView";
import { FechaSelector } from "@/components/shared/FechaSelector";

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

export default async function ReporteGuardiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fecha?: string; desde?: string; hasta?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.rol === "GUARDIA") redirect("/home");

  const { id } = await params;
  const sp = await searchParams;

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
      puesto: {
        select: {
          id: true,
          nombre: true,
          direccion: true,
          latitud: true,
          longitud: true,
          radioGeofenceM: true,
        },
      },
    },
  });

  if (!guardia || guardia.rol !== "GUARDIA") notFound();

  const rango = parseRango(sp, { defaultMode: "hoy" });
  // Para el reporte siempre necesitamos un rango (no acepta "todas" porque
  // sin límite no tiene sentido emparejar jornadas). Si vino "todas",
  // forzamos al día de hoy.
  const desde = rango.desde ?? (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const hasta = rango.hasta ?? (() => { const d = new Date(); d.setHours(23,59,59,999); return d; })();

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

  const marcasSerial: MarcaSerialized[] = marcas.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    timestampServidor: m.timestampServidor.toISOString(),
    latitud: m.latitud,
    longitud: m.longitud,
    precisionM: m.precisionM,
    distanciaPuestoM: m.distanciaPuestoM,
    dentroDelGeofence: m.dentroDelGeofence,
    esFraude: m.esFraude,
    fotoUrl: m.fotoUrl,
  }));

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex flex-wrap items-center gap-3">
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
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Reporte de jornada</h1>
          <p className="text-xs text-gray-500">
            Refrigerios y horas efectivas — uso para auditoría / facturación
          </p>
        </div>
        <a
          href={`/api/guardias/${id}/reporte/export${rango.queryString}`}
          download
          className="inline-flex items-center gap-1.5 rounded-lg bg-success-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-success-700"
          title="Descargar el reporte como CSV (abre en Excel)"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            />
          </svg>
          Exportar CSV
        </a>
      </header>

      <FechaSelector
        basePath={`/guardias/${id}/reporte`}
        rangoActual={rango}
        incluirTodas={false}
      />

      <ReporteJornadaView
        data={{
          guardia: {
            id: guardia.id,
            nombre: guardia.nombre,
            email: guardia.email,
            turnoNombre: guardia.turnoNombre,
            turnoInicio: guardia.turnoInicio,
            turnoFin: guardia.turnoFin,
            puesto: guardia.puesto
              ? {
                  id: guardia.puesto.id,
                  nombre: guardia.puesto.nombre,
                  direccion: guardia.puesto.direccion,
                }
              : null,
          },
          fecha: rango.desdeIso ?? "",
          fechaLabel: rango.label,
          reporte: serializeReporte(reporte),
          marcas: marcasSerial,
        }}
        mostrarPerfil
        puestoCoords={
          guardia.puesto
            ? {
                nombre: guardia.puesto.nombre,
                latitud: guardia.puesto.latitud,
                longitud: guardia.puesto.longitud,
                radioGeofenceM: guardia.puesto.radioGeofenceM,
              }
            : null
        }
      />
    </div>
  );
}
