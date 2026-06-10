/**
 * API: /api/puestos
 *
 * GET → lista puestos activos (para el mapa del supervisor).
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const puestos = await prisma.puesto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(puestos);
}
