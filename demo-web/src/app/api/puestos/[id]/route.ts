/**
 * API: /api/puestos/[id]
 *
 *  GET    → un puesto + conteo de guardias asignados.
 *  PATCH  → actualiza campos parciales del puesto. Solo SUPERVISOR/ADMIN.
 *  DELETE → elimina el puesto. Solo SUPERVISOR/ADMIN.
 *
 *  El borrado físico solo funciona si el puesto NO tiene marcas asociadas
 *  (Marca.puestoId tiene onDelete: Restrict). Si tiene marcas históricas,
 *  devolvemos un error 409 sugiriendo desactivar (soft-delete) en su lugar.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { editarPuestoSchema } from "@/lib/validations";

async function ensureSupervisor() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  if (session.user.rol === "GUARDIA") {
    return {
      error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }),
    };
  }
  return { error: null };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const puesto = await prisma.puesto.findUnique({
    where: { id },
    include: {
      _count: { select: { guardias: true, marcas: true } },
    },
  });
  if (!puesto) {
    return NextResponse.json({ error: "Puesto no encontrado" }, { status: 404 });
  }
  return NextResponse.json(puesto);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await ensureSupervisor();
  if (error) return error;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = editarPuestoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const exists = await prisma.puesto.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Puesto no encontrado" }, { status: 404 });
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.nombre !== undefined) updateData.nombre = data.nombre;
  if (data.direccion !== undefined) updateData.direccion = data.direccion;
  if (data.latitud !== undefined) updateData.latitud = data.latitud;
  if (data.longitud !== undefined) updateData.longitud = data.longitud;
  if (data.radioGeofenceM !== undefined)
    updateData.radioGeofenceM = data.radioGeofenceM;
  if (data.activo !== undefined) updateData.activo = data.activo;

  const actualizado = await prisma.puesto.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(actualizado);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await ensureSupervisor();
  if (error) return error;
  const { id } = await params;

  const puesto = await prisma.puesto.findUnique({
    where: { id },
    include: { _count: { select: { marcas: true, guardias: true } } },
  });
  if (!puesto) {
    return NextResponse.json({ error: "Puesto no encontrado" }, { status: 404 });
  }

  // Si tiene historial de marcas, no podemos hacer hard-delete por la FK
  // `Marca.puestoId` con onDelete: Restrict. Ofrecemos soft-delete con
  // ?soft=true o cuando el cliente envía `Force=false`.
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  if (puesto._count.marcas > 0 && !force) {
    return NextResponse.json(
      {
        error:
          "El puesto tiene marcas históricas. Usa ?force=true para borrar todo o desactiva el puesto.",
        marcasHistoricas: puesto._count.marcas,
        guardiasAsignados: puesto._count.guardias,
      },
      { status: 409 },
    );
  }

  if (force) {
    // Borrado fuerte: limpiamos primero marcas y novedades del puesto (las
    // alertas se cascadean desde ellas). Para los guardias, su FK
    // `User.puestoId` ya está con onDelete: SetNull, así que solo se
    // desasignan automáticamente.
    await prisma.$transaction([
      prisma.marca.deleteMany({ where: { puestoId: id } }),
      prisma.novedad.deleteMany({ where: { puestoId: id } }),
      prisma.puesto.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true, force: true });
  }

  await prisma.puesto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
