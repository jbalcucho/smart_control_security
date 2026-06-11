/**
 * API: /api/marcas
 *
 *   GET  → lista marcas (filtros: userId, esFraude, limit). Guardia ve solo las suyas.
 *   POST → crea una nueva marca con foto + GPS + validación de geofence.
 *
 * Implementación completa del Sprint Demo 2.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { obtenerEstadoGuardia, validarTransicion } from "@/lib/estado-guardia";
import { prisma } from "@/lib/prisma";
import { validateGeofence } from "@/lib/geofence";
import { uploadMarcaFotoFromDataUrl } from "@/lib/s3";
import { crearMarcaSchema } from "@/lib/validations";
import { TipoAlerta, Severidad, type TipoMarca } from "@prisma/client";

/** Tipos de marca que corresponden a refrigerio (no a inicio/fin de turno). */
function esRefrigerio(tipo: TipoMarca): boolean {
  return tipo === "SALIDA_REFRIGERIO" || tipo === "ENTRADA_REFRIGERIO";
}

// ============================================================
// GET: listado de marcas (con filtros)
// ============================================================

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const limit = Number(searchParams.get("limit") ?? 50);

  // Guardia solo puede ver SUS marcas. Supervisor/Admin pueden filtrar.
  const where =
    session.user.rol === "GUARDIA"
      ? { userId: session.user.id }
      : userId
        ? { userId }
        : {};

  const marcas = await prisma.marca.findMany({
    where,
    include: { user: true, puesto: true, alerta: true },
    orderBy: { timestampServidor: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json(marcas);
}

// ============================================================
// POST: crear una marca
// ============================================================

export async function POST(request: NextRequest) {
  // ---------- 1. Sesión + rol ----------
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol !== "GUARDIA") {
    return NextResponse.json(
      { error: "Solo los guardias pueden registrar marcas" },
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

  const parsed = crearMarcaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const { tipo, latitud, longitud, precisionM, timestampCliente, fotoBase64 } =
    parsed.data;

  // ---------- 3. Verificar que tenga puesto asignado ----------
  const guardia = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { puesto: true },
  });

  if (!guardia || !guardia.puesto) {
    return NextResponse.json(
      { error: "No tienes un puesto asignado. Contacta a tu supervisor." },
      { status: 409 },
    );
  }
  const puesto = guardia.puesto;
  const esRef = esRefrigerio(tipo);

  // ---------- 3b. Validar transición de estado ----------
  // (ej. no permitir SALIDA_REFRIGERIO si no estás en turno, etc.)
  const { estado: estadoActual } = await obtenerEstadoGuardia(session.user.id);
  const motivoTransicion = validarTransicion(estadoActual, tipo);
  if (motivoTransicion) {
    return NextResponse.json(
      { error: motivoTransicion, estadoActual },
      { status: 409 },
    );
  }

  // ---------- 4. Validación de geofence ----------
  // Para refrigerio NO marcamos fraude (es esperado que salga del puesto);
  // solo registramos distancia/dentroDelGeofence con fines de auditoría.
  const { dentroDelGeofence, distanciaM, motivoFraude } = validateGeofence(
    latitud,
    longitud,
    puesto.latitud,
    puesto.longitud,
    puesto.radioGeofenceM,
  );
  const esFraude = esRef ? false : !dentroDelGeofence;
  const motivoFraudeFinal = esRef ? null : motivoFraude;

  // ---------- 5. Subir foto (solo si vino) ----------
  // Refrigerios pueden venir sin selfie → fotoUrl/fotoKey quedan en null.
  let fotoUrl: string | null = null;
  let fotoKey: string | null = null;
  let storage: "s3" | "inline" | "none" = "none";
  if (fotoBase64) {
    try {
      const upload = await uploadMarcaFotoFromDataUrl(
        session.user.id,
        fotoBase64,
      );
      fotoUrl = upload.url;
      fotoKey = upload.key;
      storage = upload.storage;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error subiendo la foto";
      return NextResponse.json(
        { error: `No se pudo guardar la foto: ${message}` },
        { status: 500 },
      );
    }
  }

  // ---------- 6. Crear la marca (+ alerta si aplica) en una transacción ----------
  const userAgent = request.headers.get("user-agent") ?? null;

  const marca = await prisma.$transaction(async (tx) => {
    const created = await tx.marca.create({
      data: {
        userId: session.user.id,
        puestoId: puesto.id,
        tipo,
        fotoUrl,
        fotoKey,
        latitud,
        longitud,
        precisionM,
        distanciaPuestoM: distanciaM,
        dentroDelGeofence,
        esFraude,
        motivoFraude: motivoFraudeFinal,
        timestampCliente: new Date(timestampCliente),
        userAgent,
      },
      include: { user: true, puesto: true },
    });

    if (esFraude) {
      await tx.alerta.create({
        data: {
          marcaId: created.id,
          tipo: TipoAlerta.FUERA_GEOFENCE,
          severidad: Severidad.ALTA,
          mensaje: `${created.user.nombre} marcó fuera del geofence del puesto ${puesto.nombre} (${Math.round(distanciaM)}m).`,
        },
      });
    }

    return created;
  });

  // ---------- 7. Respuesta ----------
  return NextResponse.json(
    {
      ok: true,
      marca: {
        id: marca.id,
        tipo: marca.tipo,
        dentroDelGeofence: marca.dentroDelGeofence,
        distanciaPuestoM: marca.distanciaPuestoM,
        esFraude: marca.esFraude,
        motivoFraude: marca.motivoFraude,
        timestampServidor: marca.timestampServidor,
        puesto: {
          id: puesto.id,
          nombre: puesto.nombre,
          radioGeofenceM: puesto.radioGeofenceM,
        },
        storage,
      },
    },
    { status: 201 },
  );
}
