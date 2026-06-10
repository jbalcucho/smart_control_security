/**
 * API: /api/alertas
 *
 * GET → lista alertas. Solo supervisor/admin.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol === "GUARDIA") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const onlyPending = searchParams.get("onlyPending") === "true";

  const alertas = await prisma.alerta.findMany({
    where: onlyPending ? { resuelta: false } : {},
    include: {
      marca: { include: { user: true, puesto: true } },
    },
    orderBy: [{ severidad: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json(alertas);
}
