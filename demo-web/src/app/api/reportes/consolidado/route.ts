/**
 * API: /api/reportes/consolidado
 *
 * GET → descarga un CSV con UNA fila por guardia, resumiendo el rango
 *       seleccionado: jornadas, horas turno, horas refrigerio, horas
 *       efectivas. Ideal para conciliar facturación en bloque.
 *
 * Solo SUPERVISOR/ADMIN.
 *
 * Por defecto incluye solo guardias activos. Pasar `?incluirInactivos=true`
 * para sumar a los inactivos también.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { buildCsv, csvResponseHeaders, type CsvSection } from "@/lib/csv";
import { parseRango } from "@/lib/rango-fecha";
import { prisma } from "@/lib/prisma";
import {
  calcularReporte,
  formatDuration,
  type MarcaSimple,
} from "@/lib/reporte-jornada";

function fmtDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
    { defaultMode: "hoy" },
  );
  const incluirInactivos = searchParams.get("incluirInactivos") === "true";

  // Para reporte consolidado siempre necesitamos un rango concreto.
  const desde =
    rango.desde ??
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })();
  const hasta =
    rango.hasta ??
    (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    })();

  const guardias = await prisma.user.findMany({
    where: {
      rol: "GUARDIA",
      ...(incluirInactivos ? {} : { activo: true }),
    },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      email: true,
      activo: true,
      turnoNombre: true,
      puesto: { select: { nombre: true } },
      marcas: {
        where: { timestampServidor: { gte: desde, lte: hasta } },
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
      },
      _count: {
        select: {
          novedades: {
            where: { timestampServidor: { gte: desde, lte: hasta } },
          },
        },
      },
    },
  });

  // Encabezado del CSV
  const sections: CsvSection[] = [];

  sections.push({
    title: "Reporte consolidado",
    rows: [
      ["Periodo desde", fmtDateIso(desde)],
      ["Periodo hasta", fmtDateIso(hasta)],
      ["Etiqueta", rango.label],
      ["Guardias incluidos", guardias.length],
      [
        "Solo activos",
        incluirInactivos ? "No (incluye inactivos)" : "Sí",
      ],
      ["Generado", new Date().toLocaleString("es-CO")],
    ],
  });

  const tablaRows: Array<Array<unknown>> = [
    [
      "Guardia",
      "Email",
      "Puesto",
      "Turno",
      "Activo",
      "Jornadas",
      "# Marcas",
      "# Marcas fraude",
      "# Novedades",
      "Tiempo turno",
      "Tiempo refrigerios",
      "Tiempo efectivo",
      "Horas efectivas (decimal)",
    ],
  ];

  let totalEfectivoMs = 0;
  let totalTurnoMs = 0;
  let totalRefrigeriosMs = 0;
  let totalJornadas = 0;

  for (const g of guardias) {
    const rep = calcularReporte(g.marcas as MarcaSimple[], {
      desde,
      hasta,
      ahora: new Date(),
    });
    const fraudeCount = g.marcas.filter((m) => m.esFraude).length;

    totalEfectivoMs += rep.totalEfectivoMs;
    totalTurnoMs += rep.totalTurnoMs;
    totalRefrigeriosMs += rep.totalRefrigeriosMs;
    totalJornadas += rep.jornadas.length;

    tablaRows.push([
      g.nombre,
      g.email,
      g.puesto?.nombre ?? "(sin puesto)",
      g.turnoNombre ?? "",
      g.activo,
      rep.jornadas.length,
      g.marcas.length,
      fraudeCount,
      g._count.novedades,
      formatDuration(rep.totalTurnoMs),
      formatDuration(rep.totalRefrigeriosMs),
      formatDuration(rep.totalEfectivoMs),
      (rep.totalEfectivoMs / 3_600_000).toFixed(2),
    ]);
  }

  // Fila de totales al final
  tablaRows.push([]);
  tablaRows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    totalJornadas,
    "",
    "",
    "",
    formatDuration(totalTurnoMs),
    formatDuration(totalRefrigeriosMs),
    formatDuration(totalEfectivoMs),
    (totalEfectivoMs / 3_600_000).toFixed(2),
  ]);

  sections.push({ title: "Detalle por guardia", rows: tablaRows });

  const csv = buildCsv(sections);
  const filename = `reporte_consolidado_${fmtDateIso(desde)}_${fmtDateIso(hasta)}`;
  return new NextResponse(csv, { headers: csvResponseHeaders(filename) });
}
