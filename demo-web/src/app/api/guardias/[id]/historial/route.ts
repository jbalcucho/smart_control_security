/**
 * API: /api/guardias/[id]/historial
 *
 *  DELETE → borra TODO el contenido transaccional del guardia (marcas,
 *           novedades y alertas asociadas) sin eliminar al usuario.
 *           Es una operación pensada para DEMOS — permite limpiar la cuenta
 *           del guardia y empezar de cero sin tener que reseedear todo.
 *
 *  Solo accesible para SUPERVISOR/ADMIN.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
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
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nombre: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // El schema define Alerta -> Marca/Novedad con onDelete: Cascade, así que
  // basta con eliminar marcas y novedades del guardia. Lo hacemos en una
  // transacción para que no quede a medias.
  const [marcasDel, novedadesDel] = await prisma.$transaction([
    prisma.marca.deleteMany({ where: { userId: id } }),
    prisma.novedad.deleteMany({ where: { userId: id } }),
  ]);

  return NextResponse.json({
    ok: true,
    guardia: user.nombre,
    marcasEliminadas: marcasDel.count,
    novedadesEliminadas: novedadesDel.count,
  });
}
