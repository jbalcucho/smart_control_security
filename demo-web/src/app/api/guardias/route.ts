/**
 * API: /api/guardias
 *
 *  GET → lista de guardias (con su puesto). Solo SUPERVISOR/ADMIN.
 *        Útil para selects, modales y vistas de admin.
 *  POST → crea un nuevo guardia. Solo SUPERVISOR/ADMIN.
 *        El password viene en plano y se hashea con bcrypt antes de guardar.
 */

import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearGuardiaSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 10;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol === "GUARDIA") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { rol: { in: ["GUARDIA", "SUPERVISOR", "ADMIN"] } },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      turnoNombre: true,
      turnoInicio: true,
      turnoFin: true,
      createdAt: true,
      puesto: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(users);
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

  const parsed = crearGuardiaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Verificar email único antes de pasar a Prisma para devolver un mensaje claro.
  const existente = await prisma.user.findUnique({ where: { email: data.email } });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email" },
      { status: 409 },
    );
  }

  // Si se asigna puesto, validar que exista.
  if (data.puestoId) {
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

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const nuevo = await prisma.user.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password: passwordHash,
      rol: data.rol,
      activo: data.activo,
      puestoId: data.puestoId ?? null,
      turnoNombre: data.turnoNombre ?? null,
      turnoInicio: data.turnoInicio ?? null,
      turnoFin: data.turnoFin ?? null,
    },
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

  return NextResponse.json(nuevo, { status: 201 });
}
