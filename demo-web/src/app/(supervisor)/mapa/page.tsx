/**
 * Mapa del Supervisor.
 *
 * Server Component que precarga puestos + marcas + novedades activas y
 * delega el render a <MapaSupervisor /> (que internamente carga Leaflet
 * con dynamic import porque usa `window`).
 *
 * Filtros aceptados:
 *   - ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD → rango explícito
 *   - ?fecha=YYYY-MM-DD                  → un solo día
 *   - ?fecha=todas / sin query           → vista live (últimas 50 marcas y
 *                                          novedades activas)
 */

import { FechaSelector } from "@/components/shared/FechaSelector";
import { parseRango } from "@/lib/rango-fecha";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { MapaSupervisor } from "@/components/supervisor/MapaSupervisor";
import type {
  MapaSnapshot,
  MarcaMapa,
  NovedadMapa,
  PuestoMapa,
} from "@/components/supervisor/mapa-types";

const POLL_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MS ?? 10_000);

export default async function MapaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; desde?: string; hasta?: string }>;
}) {
  const sp = await searchParams;
  const rango = parseRango(sp, { defaultMode: "todas" });
  const tieneRango = rango.desde != null && rango.hasta != null;

  const whereMarca: Prisma.MarcaWhereInput = tieneRango
    ? { timestampServidor: { gte: rango.desde!, lte: rango.hasta! } }
    : {};

  // En modo rango: todas las novedades del periodo (incluye RESUELTAS) para
  // poder auditar histórico. Sin rango: solo activas.
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
      take: tieneRango ? 500 : 50,
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
      take: 200,
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

  // Igual que en /api/mapa-snapshot: si la novedad no trae GPS, usamos coords
  // del puesto asignado como fallback para no ocultar pánicos.
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
        timestampServidor: n.timestampServidor.toISOString(),
        user: n.user,
        puesto: n.puesto ? { id: n.puesto.id, nombre: n.puesto.nombre } : null,
      },
    ];
  });

  const initial: MapaSnapshot = {
    puestos: puestos as PuestoMapa[],
    marcas: marcas.map((m) => ({
      ...m,
      timestampServidor: m.timestampServidor.toISOString(),
    })) as MarcaMapa[],
    novedades: novedadesMapa as NovedadMapa[],
    generatedAt: new Date().toISOString(),
  };

  // Para el polling del cliente, le pasamos los mismos filtros para que la
  // API siga devolviendo lo mismo (sin perder el filtro al refrescar).
  const apiQueryString = rango.queryString ? rango.queryString.slice(1) : "";

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapa</h1>
          <p className="mt-1 text-sm text-gray-600">
            {tieneRango ? (
              <>
                Marcas y novedades del periodo{" "}
                <span className="font-medium capitalize">{rango.label}</span> —{" "}
                {marcas.length} marca{marcas.length === 1 ? "" : "s"} ·{" "}
                {novedadesMapa.length} novedad
                {novedadesMapa.length === 1 ? "" : "es"}
              </>
            ) : (
              <>
                Vista en vivo: últimas {marcas.length} marca
                {marcas.length === 1 ? "" : "s"} + novedades activas
              </>
            )}
          </p>
        </div>
      </header>

      <FechaSelector basePath="/mapa" rangoActual={rango} />

      <MapaSupervisor
        initial={initial}
        pollMs={POLL_MS}
        apiQueryString={apiQueryString}
        rangoLabel={tieneRango ? rango.label : null}
      />
    </div>
  );
}
