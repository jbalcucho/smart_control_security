/**
 * Reporte de jornada del propio guardia (vista del día).
 *
 * Server Component que calcula el reporte directamente desde la BD
 * para evitar un round-trip HTTP.
 */

import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calcularReporte,
  type MarcaSimple,
  type Refrigerio,
  type Jornada,
  type ReporteJornada,
} from "@/lib/reporte-jornada";
import {
  ReporteJornadaView,
  type MarcaSerialized,
} from "@/components/shared/ReporteJornadaView";

// Serializa fechas (Date → string) para pasar a un client component sin perder
// el tipo. Idéntico shape al que devuelve /api/guardias/[id]/reporte.
function serializeReporte(r: ReporteJornada) {
  return {
    ...r,
    generadoEn: r.generadoEn.toISOString(),
    desde: r.desde.toISOString(),
    hasta: r.hasta.toISOString(),
    jornadas: r.jornadas.map(serializeJornada),
  };
}

function serializeJornada(j: Jornada) {
  return {
    ...j,
    inicio: j.inicio.toISOString(),
    fin: j.fin.toISOString(),
    refrigerios: j.refrigerios.map(serializeRefrigerio),
  };
}

function serializeRefrigerio(r: Refrigerio) {
  return {
    ...r,
    salida: r.salida.toISOString(),
    entrada: r.entrada.toISOString(),
  };
}

export default async function MiReportePage() {
  const session = await auth();
  if (!session?.user) return null;

  const guardia = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      nombre: true,
      email: true,
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
  if (!guardia) return null;

  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date();
  hasta.setHours(23, 59, 59, 999);

  const marcas = await prisma.marca.findMany({
    where: {
      userId: session.user.id,
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

  const fechaIso = desde.toISOString().slice(0, 10);
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
          <h1 className="text-xl font-bold text-gray-900">Mi reporte de hoy</h1>
          <p className="text-xs text-gray-500">
            Refrigerios y horas efectivas trabajadas
          </p>
        </div>
      </header>

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
          fecha: fechaIso,
          reporte: serializeReporte(reporte),
          marcas: marcasSerial,
        }}
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
