/**
 * API: /api/guardias/[id]/reporte
 *
 * GET → devuelve el reporte de jornada de un guardia para un día.
 *   Query params:
 *     - fecha=YYYY-MM-DD  (opcional, default = hoy)
 *
 *   Accesible para:
 *     - El propio guardia (puede ver su propio reporte)
 *     - Supervisor / Admin
 *
 *   Devuelve:
 *     - Datos del guardia + puesto
 *     - Jornadas del día con sus refrigerios emparejados
 *     - Totales (tiempo turno, tiempo refrigerios, tiempo efectivo)
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularReporte, type MarcaSimple } from "@/lib/reporte-jornada";

function parsearFecha(raw: string | null): { desde: Date; hasta: Date } {
  const ref = raw ? new Date(`${raw}T00:00:00`) : new Date();
  if (Number.isNaN(ref.getTime())) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(hoy);
    fin.setHours(23, 59, 59, 999);
    return { desde: hoy, hasta: fin };
  }
  const desde = new Date(ref);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(ref);
  hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: guardiaId } = await context.params;

  // Un guardia solo puede ver su propio reporte; supervisor/admin pueden ver cualquiera.
  if (session.user.rol === "GUARDIA" && session.user.id !== guardiaId) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const guardia = await prisma.user.findUnique({
    where: { id: guardiaId },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      turnoNombre: true,
      turnoInicio: true,
      turnoFin: true,
      puesto: {
        select: { id: true, nombre: true, direccion: true },
      },
    },
  });

  if (!guardia) {
    return NextResponse.json(
      { error: "Guardia no encontrado" },
      { status: 404 },
    );
  }
  if (guardia.rol !== "GUARDIA") {
    return NextResponse.json(
      { error: "El usuario no es un guardia" },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const { desde, hasta } = parsearFecha(searchParams.get("fecha"));

  const marcas = await prisma.marca.findMany({
    where: {
      userId: guardiaId,
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

  return NextResponse.json({
    guardia,
    fecha: desde.toISOString().slice(0, 10),
    reporte,
    marcas,
  });
}
