/**
 * API: /api/mapa-snapshot
 *
 * GET → devuelve en UN solo call todo lo necesario para renderizar el mapa
 *       del supervisor: puestos activos + marcas recientes + novedades activas.
 *
 *   - Sólo accesible a SUPERVISOR/ADMIN.
 *   - "Marcas recientes" = últimas N (por defecto 50) con coordenadas.
 *   - "Novedades activas" = estado PENDIENTE o EN_ATENCION. Si la novedad
 *     no trajo GPS (caso típico de botón de pánico con countdown corto),
 *     usamos las coords del puesto asignado y dejamos precisionM=null para
 *     que el cliente pueda etiquetarlas como "ubicación aproximada".
 *
 * Diseñado para ser consumido por polling (cada 10-15s) sin sobrecargar la BD.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_MARCAS_LIMIT = 50;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol === "GUARDIA") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const marcasLimit = Math.min(
    Math.max(Number(searchParams.get("marcasLimit") ?? DEFAULT_MARCAS_LIMIT), 1),
    200,
  );

  const [puestos, marcas, novedades] = await Promise.all([
    prisma.puesto.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        direccion: true,
        latitud: true,
        longitud: true,
        radioGeofenceM: true,
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.marca.findMany({
      orderBy: { timestampServidor: "desc" },
      take: marcasLimit,
      select: {
        id: true,
        tipo: true,
        latitud: true,
        longitud: true,
        precisionM: true,
        distanciaPuestoM: true,
        dentroDelGeofence: true,
        esFraude: true,
        timestampServidor: true,
        fotoUrl: true,
        user: { select: { id: true, nombre: true } },
        puesto: { select: { id: true, nombre: true } },
      },
    }),
    prisma.novedad.findMany({
      where: {
        estado: { in: ["PENDIENTE", "EN_ATENCION"] },
      },
      orderBy: { timestampServidor: "desc" },
      take: 100,
      select: {
        id: true,
        tipo: true,
        severidad: true,
        estado: true,
        descripcion: true,
        refuerzosNecesarios: true,
        latitud: true,
        longitud: true,
        precisionM: true,
        timestampServidor: true,
        user: { select: { id: true, nombre: true } },
        puesto: {
          select: { id: true, nombre: true, latitud: true, longitud: true },
        },
      },
    }),
  ]);

  // Completar coords desde el puesto si la novedad no trae GPS, y descartar
  // las que tampoco se pueden ubicar (sin GPS y sin puesto con coords).
  const novedadesMapa = novedades.flatMap((n) => {
    const lat = n.latitud ?? n.puesto?.latitud ?? null;
    const lon = n.longitud ?? n.puesto?.longitud ?? null;
    if (lat == null || lon == null) return [];
    return [
      {
        id: n.id,
        tipo: n.tipo,
        severidad: n.severidad,
        estado: n.estado,
        descripcion: n.descripcion,
        refuerzosNecesarios: n.refuerzosNecesarios,
        latitud: lat,
        longitud: lon,
        precisionM: n.precisionM,
        timestampServidor: n.timestampServidor,
        user: n.user,
        puesto: n.puesto
          ? { id: n.puesto.id, nombre: n.puesto.nombre }
          : null,
      },
    ];
  });

  return NextResponse.json({
    puestos,
    marcas,
    novedades: novedadesMapa,
    generatedAt: new Date().toISOString(),
  });
}
