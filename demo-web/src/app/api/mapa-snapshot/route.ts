/**
 * API: /api/mapa-snapshot
 *
 * GET → devuelve en UN solo call todo lo necesario para renderizar el mapa
 *       del supervisor: puestos activos + marcas + novedades.
 *
 *   - Sólo accesible a SUPERVISOR/ADMIN.
 *   - Si no se envía filtro de fecha: comportamiento anterior — últimas N
 *     marcas y novedades PENDIENTES/EN_ATENCION.
 *   - Con filtro (`?desde=&hasta=` o `?fecha=`): marcas y novedades dentro
 *     del rango (sin restringir el estado de la novedad, para auditoría).
 *
 * Diseñado para ser consumido por polling (cada 10-15s) sin sobrecargar la BD.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { parseRango } from "@/lib/rango-fecha";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const DEFAULT_MARCAS_LIMIT = 50;
const RANGE_MARCAS_LIMIT = 500;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol === "GUARDIA") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rango = parseRango(
    {
      fecha: searchParams.get("fecha") ?? undefined,
      desde: searchParams.get("desde") ?? undefined,
      hasta: searchParams.get("hasta") ?? undefined,
    },
    { defaultMode: "todas" },
  );

  const tieneRango = rango.desde != null && rango.hasta != null;

  const marcasLimit = tieneRango
    ? RANGE_MARCAS_LIMIT
    : Math.min(
        Math.max(Number(searchParams.get("marcasLimit") ?? DEFAULT_MARCAS_LIMIT), 1),
        200,
      );

  const whereMarca: Prisma.MarcaWhereInput = tieneRango
    ? { timestampServidor: { gte: rango.desde!, lte: rango.hasta! } }
    : {};

  // En modo rango mostramos TODAS las novedades del periodo (independiente
  // del estado) para que el supervisor pueda auditar histórico. Sin rango,
  // solo activas (PENDIENTE / EN_ATENCION).
  const whereNovedad: Prisma.NovedadWhereInput = tieneRango
    ? { timestampServidor: { gte: rango.desde!, lte: rango.hasta! } }
    : { estado: { in: ["PENDIENTE", "EN_ATENCION"] } };

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
      where: whereMarca,
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
      where: whereNovedad,
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
    rango: {
      modo: rango.modo,
      label: rango.label,
      desde: rango.desdeIso,
      hasta: rango.hastaIso,
    },
    generatedAt: new Date().toISOString(),
  });
}
