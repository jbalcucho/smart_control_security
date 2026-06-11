/**
 * API: /api/guardias/[id]
 *
 *  GET    → un guardia + su puesto. Solo SUPERVISOR/ADMIN.
 *  PATCH  → actualiza campos parciales (incluido reasignación de puesto y
 *           reseteo de contraseña). Solo SUPERVISOR/ADMIN.
 *  DELETE → elimina el guardia. Por la relación `Marca.userId` con
 *           `onDelete: Cascade` esto borra TODAS sus marcas/novedades.
 *           Solo SUPERVISOR/ADMIN. No permite borrarse a sí mismo.
 */

import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { editarGuardiaSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 10;

async function ensureSupervisor() {
  const session = await auth();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
      session: null,
    };
  }
  if (session.user.rol === "GUARDIA") {
    return {
      error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await ensureSupervisor();
  if (error) return error;
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      turnoNombre: true,
      turnoInicio: true,
      turnoFin: true,
      puesto: { select: { id: true, nombre: true, direccion: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  return NextResponse.json(user);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await ensureSupervisor();
  if (error) return error;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = editarGuardiaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Si cambia email, validar unicidad.
  if (data.email) {
    const dup = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id } },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: "Ese email ya está en uso por otro usuario" },
        { status: 409 },
      );
    }
  }

  // Si cambia puesto, validar que exista (puestoId puede ser null para desasignar).
  if (data.puestoId !== undefined && data.puestoId !== null) {
    const puesto = await prisma.puesto.findUnique({
      where: { id: data.puestoId },
      select: { id: true },
    });
    if (!puesto) {
      return NextResponse.json(
        { error: "El puesto seleccionado no existe" },
        { status: 400 },
      );
    }
  }

  // Protección: nadie puede desactivarse a sí mismo (queda fuera del sistema).
  if (id === session!.user.id && data.activo === false) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta" },
      { status: 400 },
    );
  }

  const updateData: Record<string, unknown> = {};
  if (data.nombre !== undefined) updateData.nombre = data.nombre;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.rol !== undefined) updateData.rol = data.rol;
  if (data.activo !== undefined) updateData.activo = data.activo;
  if (data.puestoId !== undefined) updateData.puestoId = data.puestoId;
  if (data.turnoNombre !== undefined) updateData.turnoNombre = data.turnoNombre;
  if (data.turnoInicio !== undefined) updateData.turnoInicio = data.turnoInicio;
  if (data.turnoFin !== undefined) updateData.turnoFin = data.turnoFin;
  if (data.password !== undefined) {
    updateData.password = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  }

  const actualizado = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      turnoNombre: true,
      turnoInicio: true,
      turnoFin: true,
      puesto: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(actualizado);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await ensureSupervisor();
  if (error) return error;
  const { id } = await params;

  if (id === session!.user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 },
    );
  }

  // Borrado en cascada: Prisma cascadea Marca y Novedad (definido en el
  // schema con onDelete: Cascade). Alerta se cascadea desde Marca/Novedad.
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
