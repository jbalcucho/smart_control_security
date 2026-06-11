/**
 * API: /api/guardias/[id]/reporte/export
 *
 * GET → descarga un CSV con el reporte de jornada del guardia en el rango
 *       dado (?desde=&hasta= o ?fecha=). Pensado para auditoría /
 *       facturación: incluye resumen agregado + lista de jornadas con sus
 *       refrigerios + detalle cronológico de cada marca con GPS.
 *
 * Solo SUPERVISOR/ADMIN.
 *
 * El archivo CSV se construye en formato multi-sección (varios bloques
 * con título), separador `;` y BOM UTF-8 para que Excel lo abra limpio.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { buildCsv, csvResponseHeaders, type CsvSection } from "@/lib/csv";
import { parseRango } from "@/lib/rango-fecha";
import { prisma } from "@/lib/prisma";
import {
  calcularReporte,
  formatDuration,
  formatHourMinute,
  type MarcaSimple,
} from "@/lib/reporte-jornada";
import type { TipoMarca } from "@prisma/client";

function tipoLabel(t: TipoMarca): string {
  switch (t) {
    case "ENTRADA":
      return "Entrada de turno";
    case "SALIDA":
      return "Salida de turno";
    case "SALIDA_REFRIGERIO":
      return "Sale a refrigerio";
    case "ENTRADA_REFRIGERIO":
      return "Regresa de refrigerio";
  }
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function fmtDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol === "GUARDIA") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const rango = parseRango(
    {
      fecha: searchParams.get("fecha") ?? undefined,
      desde: searchParams.get("desde") ?? undefined,
      hasta: searchParams.get("hasta") ?? undefined,
    },
    { defaultMode: "hoy" },
  );

  // Para reporte siempre necesitamos un rango (no acepta "todas").
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
      puesto: { select: { nombre: true, direccion: true } },
    },
  });
  if (!guardia || guardia.rol !== "GUARDIA") {
    return NextResponse.json({ error: "Guardia no encontrado" }, { status: 404 });
  }

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
      motivoFraude: true,
    },
  });

  const reporte = calcularReporte(marcas as MarcaSimple[], {
    desde,
    hasta,
    ahora: new Date(),
  });

  // ----------------------------------------------------------
  // Construcción del CSV multi-sección
  // ----------------------------------------------------------
  const sections: CsvSection[] = [];

  // Sección 1: información general
  sections.push({
    title: "Reporte de jornada",
    rows: [
      ["Guardia", guardia.nombre],
      ["Email", guardia.email],
      ["Puesto", guardia.puesto?.nombre ?? "(sin puesto)"],
      ["Dirección", guardia.puesto?.direccion ?? ""],
      [
        "Turno",
        guardia.turnoNombre
          ? `${guardia.turnoNombre}${guardia.turnoInicio ? ` (${guardia.turnoInicio}–${guardia.turnoFin})` : ""}`
          : "(no definido)",
      ],
      ["Periodo desde", fmtDateIso(desde)],
      ["Periodo hasta", fmtDateIso(hasta)],
      ["Etiqueta", rango.label],
      ["Generado", fmtDateTime(reporte.generadoEn)],
    ],
  });

  // Sección 2: totales agregados
  sections.push({
    title: "Totales del periodo",
    rows: [
      ["Concepto", "Valor"],
      ["Jornadas registradas", reporte.jornadas.length],
      ["Tiempo total en turno", formatDuration(reporte.totalTurnoMs)],
      ["Tiempo total refrigerios", formatDuration(reporte.totalRefrigeriosMs)],
      ["Tiempo efectivo trabajado", formatDuration(reporte.totalEfectivoMs)],
      ["Horas efectivas (decimal)", (reporte.totalEfectivoMs / 3_600_000).toFixed(2)],
    ],
  });

  // Sección 3: jornadas
  const jornadasRows: Array<Array<unknown>> = [
    [
      "#",
      "Fecha",
      "Inicio",
      "Fin",
      "Abierta",
      "Duración turno",
      "# Refrigerios",
      "Tiempo refrigerios",
      "Tiempo efectivo",
      "Efectivo (h)",
    ],
  ];
  reporte.jornadas.forEach((j, i) => {
    jornadasRows.push([
      i + 1,
      fmtDateIso(j.inicio),
      formatHourMinute(j.inicio),
      formatHourMinute(j.fin),
      j.abierta,
      formatDuration(j.duracionTurnoMs),
      j.refrigerios.length,
      formatDuration(j.totalRefrigeriosMs),
      formatDuration(j.duracionEfectivaMs),
      (j.duracionEfectivaMs / 3_600_000).toFixed(2),
    ]);
  });
  sections.push({ title: "Jornadas", rows: jornadasRows });

  // Sección 4: refrigerios detallados
  const refrigeriosRows: Array<Array<unknown>> = [
    [
      "Jornada",
      "#",
      "Salida",
      "Regreso",
      "Duración",
      "Duración (min)",
      "Cerrado con salida",
    ],
  ];
  reporte.jornadas.forEach((j, ji) => {
    j.refrigerios.forEach((r, ri) => {
      refrigeriosRows.push([
        ji + 1,
        ri + 1,
        fmtDateTime(r.salida),
        fmtDateTime(r.entrada),
        formatDuration(r.duracionMs),
        Math.round(r.duracionMs / 60_000),
        r.cerradoConSalida,
      ]);
    });
  });
  if (refrigeriosRows.length > 1) {
    sections.push({ title: "Refrigerios", rows: refrigeriosRows });
  }

  // Sección 5: detalle cronológico de cada marca
  const marcasRows: Array<Array<unknown>> = [
    [
      "Timestamp",
      "Tipo",
      "Latitud",
      "Longitud",
      "Precisión GPS (m)",
      "Distancia al puesto (m)",
      "Dentro geofence",
      "Es fraude",
      "Motivo fraude",
      "Tiene foto",
    ],
  ];
  marcas.forEach((m) => {
    marcasRows.push([
      fmtDateTime(m.timestampServidor),
      tipoLabel(m.tipo),
      m.latitud != null ? m.latitud.toFixed(6) : "",
      m.longitud != null ? m.longitud.toFixed(6) : "",
      m.precisionM != null ? Math.round(m.precisionM) : "",
      m.distanciaPuestoM != null ? Math.round(m.distanciaPuestoM) : "",
      m.dentroDelGeofence,
      m.esFraude,
      m.motivoFraude ?? "",
      m.fotoUrl != null,
    ]);
  });
  sections.push({ title: "Marcas (detalle)", rows: marcasRows });

  const csv = buildCsv(sections);

  const filename = `reporte_${guardia.nombre.replace(/\s+/g, "_")}_${fmtDateIso(desde)}_${fmtDateIso(hasta)}`;
  return new NextResponse(csv, { headers: csvResponseHeaders(filename) });
}
