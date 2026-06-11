/**
 * API: /api/puestos
 *
 *  GET  → lista puestos. Por default activos (incluye `?incluirInactivos=true`
 *         para traerlos todos). Cualquier autenticado puede leer.
 *  POST → crea un nuevo puesto. Solo SUPERVISOR/ADMIN.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearPuestoSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const incluirInactivos = searchParams.get("incluirInactivos") === "true";

  const puestos = await prisma.puesto.findMany({
    where: incluirInactivos ? {} : { activo: true },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      _count: { select: { guardias: true } },
    },
  });

  return NextResponse.json(puestos);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol === "GUARDIA") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = crearPuestoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nuevo = await prisma.puesto.create({
    data: {
      nombre: parsed.data.nombre,
      direccion: parsed.data.direccion,
      latitud: parsed.data.latitud,
      longitud: parsed.data.longitud,
      radioGeofenceM: parsed.data.radioGeofenceM,
      activo: parsed.data.activo,
    },
  });

  return NextResponse.json(nuevo, { status: 201 });
}
