/**
 * Panel de Alertas del Supervisor.
 *
 * Server Component que precarga las alertas (Marca + Novedad). Soporta filtro
 * de fecha por rango y toggle "Solo pendientes / Todas".
 *
 *   - ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD → rango explícito
 *   - ?fecha=YYYY-MM-DD                  → un solo día
 *   - ?fecha=todas                       → sin filtro de tiempo
 *   - sin query                          → "Hoy" + solo pendientes
 *   - ?incluirResueltas=true             → incluye alertas ya resueltas
 */

import Link from "next/link";

import { parseRango } from "@/lib/rango-fecha";
import { prisma } from "@/lib/prisma";
import { FechaSelector } from "@/components/shared/FechaSelector";
import {
  AlertasList,
  type AlertaListItem,
} from "@/components/supervisor/AlertasList";
import type { Prisma } from "@prisma/client";

const POLL_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MS ?? 5000);

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{
    fecha?: string;
    desde?: string;
    hasta?: string;
    incluirResueltas?: string;
  }>;
}) {
  const sp = await searchParams;
  const rango = parseRango(sp, { defaultMode: "hoy" });
  const incluirResueltas = sp.incluirResueltas === "true";

  // WHERE para Prisma combinando estado + rango.
  const where: Prisma.AlertaWhereInput = {};
  if (!incluirResueltas) where.resuelta = false;
  if (rango.desde && rango.hasta) {
    where.createdAt = { gte: rango.desde, lte: rango.hasta };
  }

  const alertas = await prisma.alerta.findMany({
    where,
    include: {
      marca: {
        include: {
          user: { select: { id: true, nombre: true, email: true } },
          puesto: { select: { id: true, nombre: true } },
        },
      },
      novedad: {
        include: {
          user: { select: { id: true, nombre: true, email: true } },
          puesto: { select: { id: true, nombre: true, direccion: true } },
        },
      },
    },
    orderBy: [{ severidad: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const initial: AlertaListItem[] = alertas.map((a) => ({
    id: a.id,
    tipo: a.tipo,
    severidad: a.severidad,
    mensaje: a.mensaje,
    resuelta: a.resuelta,
    createdAt: a.createdAt.toISOString(),
    marca: a.marca
      ? {
          id: a.marca.id,
          user: a.marca.user,
          puesto: { id: a.marca.puesto.id, nombre: a.marca.puesto.nombre },
        }
      : null,
    novedad: a.novedad
      ? {
          id: a.novedad.id,
          tipo: a.novedad.tipo,
          descripcion: a.novedad.descripcion,
          refuerzosNecesarios: a.novedad.refuerzosNecesarios,
          latitud: a.novedad.latitud,
          longitud: a.novedad.longitud,
          user: a.novedad.user,
          puesto: a.novedad.puesto,
        }
      : null,
  }));

  // Query string para el toggle "incluir resueltas" (preservando fecha).
  const fechaQs = rango.queryString || "?";
  const sep = fechaQs.length > 1 ? "&" : "";
  const linkToggleResueltas = incluirResueltas
    ? `/alertas${rango.queryString}`
    : `/alertas${fechaQs}${sep}incluirResueltas=true`;

  // Query string que usará el polling para mantener el mismo filtro.
  const apiParts: string[] = [];
  if (incluirResueltas) apiParts.push("incluirResueltas=true");
  else apiParts.push("onlyPending=true");
  if (rango.queryString) {
    // rango.queryString viene como "?desde=...&hasta=..." o "?fecha=..."
    apiParts.push(rango.queryString.slice(1));
  }
  const apiQueryString = apiParts.join("&");

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-medium capitalize">{rango.label}</span> ·{" "}
            {incluirResueltas
              ? "incluyendo resueltas"
              : "solo pendientes"}{" "}
            · {alertas.length}{" "}
            {alertas.length === 1 ? "alerta" : "alertas"}
          </p>
        </div>
        <Link
          href={linkToggleResueltas}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {incluirResueltas ? "Ocultar resueltas" : "Incluir resueltas"}
        </Link>
      </header>

      <FechaSelector basePath="/alertas" rangoActual={rango} />

      <AlertasList
        initial={initial}
        pollMs={POLL_MS}
        apiQueryString={apiQueryString}
      />
    </div>
  );
}
