/**
 * API: /api/novedades
 *
 *   GET  → lista novedades. Guardia ve sólo las suyas; Supervisor/Admin ven todas.
 *          Query params: estado, tipo, severidad, limit (máx 200).
 *   POST → el guardia reporta una novedad (incidente, refuerzo, pánico).
 *          Si tipo ∈ {PANICO, REFUERZO} se crea automáticamente una Alerta
 *          asociada para que aparezca en el panel del supervisor.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearNovedadSchema } from "@/lib/validations";
import {
  TipoNovedad,
  EstadoNovedad,
  Severidad,
  TipoAlerta,
  type Prisma,
} from "@prisma/client";

// ============================================================
// Helpers
// ============================================================

/** Severidad por defecto en función del tipo de novedad. */
function severidadPorTipo(
  tipo: TipoNovedad,
  refuerzosNecesarios: boolean,
): Severidad {
  if (tipo === TipoNovedad.PANICO) return Severidad.ALTA;
  if (tipo === TipoNovedad.REFUERZO) return Severidad.ALTA;
  if (tipo === TipoNovedad.GENERAL && refuerzosNecesarios) return Severidad.ALTA;
  if (tipo === TipoNovedad.GENERAL) return Severidad.MEDIA;
  return Severidad.BAJA; // INFORMATIVA
}

/** Genera el mensaje humano de la alerta asociada a una novedad. */
function mensajeAlerta(args: {
  tipo: TipoNovedad;
  nombreGuardia: string;
  nombrePuesto: string | null;
  descripcion: string;
}): string {
  const { tipo, nombreGuardia, nombrePuesto, descripcion } = args;
  const ubicacion = nombrePuesto ? ` en ${nombrePuesto}` : "";

  if (tipo === TipoNovedad.PANICO) {
    return `🚨 PÁNICO: ${nombreGuardia} activó el botón de emergencia${ubicacion}.`;
  }
  if (tipo === TipoNovedad.REFUERZO) {
    return `👥 Refuerzos: ${nombreGuardia} solicita apoyo${ubicacion}. ${descripcion || ""}`.trim();
  }
  return `Novedad de ${nombreGuardia}${ubicacion}: ${descripcion}`;
}

/** Devuelve el tipo de Alerta que corresponde a una novedad escalable. */
function tipoAlertaParaNovedad(tipo: TipoNovedad): TipoAlerta | null {
  if (tipo === TipoNovedad.PANICO) return TipoAlerta.NOVEDAD_PANICO;
  if (tipo === TipoNovedad.REFUERZO) return TipoAlerta.NOVEDAD_REFUERZO;
  return null;
}

// ============================================================
// GET: listado de novedades
// ============================================================

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const tipo = searchParams.get("tipo");
  const severidad = searchParams.get("severidad");
  const limit = Number(searchParams.get("limit") ?? 50);

  const where: Prisma.NovedadWhereInput = {};

  // Guardia sólo ve sus propias novedades
  if (session.user.rol === "GUARDIA") {
    where.userId = session.user.id;
  }

  if (estado && estado in EstadoNovedad) {
    where.estado = estado as EstadoNovedad;
  }
  if (tipo && tipo in TipoNovedad) {
    where.tipo = tipo as TipoNovedad;
  }
  if (severidad && severidad in Severidad) {
    where.severidad = severidad as Severidad;
  }

  const novedades = await prisma.novedad.findMany({
    where,
    include: {
      user: { select: { id: true, nombre: true, email: true } },
      puesto: { select: { id: true, nombre: true, direccion: true } },
      alerta: true,
    },
    orderBy: { timestampServidor: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });

  return NextResponse.json(novedades);
}

// ============================================================
// POST: crear una novedad
// ============================================================

export async function POST(request: NextRequest) {
  // ---------- 1. Sesión + rol ----------
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol !== "GUARDIA") {
    return NextResponse.json(
      { error: "Solo los guardias pueden reportar novedades" },
      { status: 403 },
    );
  }

  // ---------- 2. Parseo + validación del body ----------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = crearNovedadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const {
    tipo,
    descripcion,
    refuerzosNecesarios,
    latitud,
    longitud,
    precisionM,
    timestampCliente,
  } = parsed.data;

  // ---------- 3. Cargar guardia + puesto (puesto puede ser null) ----------
  const guardia = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { puesto: true },
  });
  if (!guardia) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // ---------- 4. Calcular severidad y descripción efectiva ----------
  const severidad = severidadPorTipo(
    tipo as TipoNovedad,
    refuerzosNecesarios ?? false,
  );

  // Para PANICO permitimos descripción vacía → usamos un default.
  const descripcionFinal =
    descripcion && descripcion.trim().length > 0
      ? descripcion.trim()
      : tipo === "PANICO"
        ? "Botón de pánico activado."
        : "";

  const userAgent = request.headers.get("user-agent") ?? null;

  // ---------- 4b. Fallback de coordenadas ----------
  // Si el cliente no logró capturar GPS a tiempo (caso típico del botón de
  // pánico: countdown corto y primer fix de geolocalización lento) y el
  // guardia tiene puesto asignado con coordenadas, usamos las del puesto.
  // Marcamos `precisionM = null` para que el mapa pueda distinguir entre
  // "ubicación GPS real" y "ubicación aproximada del puesto".
  let latFinal: number | null = latitud ?? null;
  let lonFinal: number | null = longitud ?? null;
  let precFinal: number | null = precisionM ?? null;
  if (
    (latFinal == null || lonFinal == null) &&
    guardia.puesto &&
    guardia.puesto.latitud != null &&
    guardia.puesto.longitud != null
  ) {
    latFinal = guardia.puesto.latitud;
    lonFinal = guardia.puesto.longitud;
    precFinal = null;
  }

  // ---------- 5. Crear novedad + alerta (si aplica) en transacción ----------
  const { novedad, alerta } = await prisma.$transaction(async (tx) => {
    const novedadCreada = await tx.novedad.create({
      data: {
        userId: session.user.id,
        puestoId: guardia.puesto?.id ?? null,
        tipo: tipo as TipoNovedad,
        severidad,
        descripcion: descripcionFinal,
        refuerzosNecesarios: refuerzosNecesarios ?? false,
        latitud: latFinal,
        longitud: lonFinal,
        precisionM: precFinal,
        timestampCliente: new Date(timestampCliente),
        userAgent,
      },
    });

    const tipoAlerta = tipoAlertaParaNovedad(tipo as TipoNovedad);
    let alertaCreada = null;
    if (tipoAlerta) {
      alertaCreada = await tx.alerta.create({
        data: {
          novedadId: novedadCreada.id,
          tipo: tipoAlerta,
          severidad,
          mensaje: mensajeAlerta({
            tipo: tipo as TipoNovedad,
            nombreGuardia: guardia.nombre,
            nombrePuesto: guardia.puesto?.nombre ?? null,
            descripcion: descripcionFinal,
          }),
        },
      });
    }

    return { novedad: novedadCreada, alerta: alertaCreada };
  });

  // ---------- 6. Respuesta ----------
  return NextResponse.json(
    {
      ok: true,
      novedad: {
        id: novedad.id,
        tipo: novedad.tipo,
        severidad: novedad.severidad,
        estado: novedad.estado,
        descripcion: novedad.descripcion,
        refuerzosNecesarios: novedad.refuerzosNecesarios,
        latitud: novedad.latitud,
        longitud: novedad.longitud,
        precisionM: novedad.precisionM,
        timestampServidor: novedad.timestampServidor,
        puesto: guardia.puesto
          ? { id: guardia.puesto.id, nombre: guardia.puesto.nombre }
          : null,
      },
      alerta: alerta
        ? {
            id: alerta.id,
            tipo: alerta.tipo,
            severidad: alerta.severidad,
            mensaje: alerta.mensaje,
          }
        : null,
    },
    { status: 201 },
  );
}
