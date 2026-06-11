/**
 * API: /api/alertas
 *
 * GET → lista alertas. Solo supervisor/admin.
 * Acepta los mismos filtros que la página /alertas (rango + incluirResueltas)
 * para que el polling no rompa la vista filtrada.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { parseRango } from "@/lib/rango-fecha";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.rol === "GUARDIA") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  // Compat con el AlertasList anterior (onlyPending=true).
  const onlyPending =
    searchParams.get("onlyPending") === "true" ||
    searchParams.get("incluirResueltas") !== "true";

  const rango = parseRango(
    {
      fecha: searchParams.get("fecha") ?? undefined,
      desde: searchParams.get("desde") ?? undefined,
      hasta: searchParams.get("hasta") ?? undefined,
    },
    { defaultMode: "todas" },
  );

  const where: Prisma.AlertaWhereInput = {};
  if (onlyPending) where.resuelta = false;
  if (rango.desde && rango.hasta) {
    where.createdAt = { gte: rango.desde, lte: rango.hasta };
  }

  const alertas = await prisma.alerta.findMany({
    where,
    include: {
      marca: { include: { user: true, puesto: true } },
      novedad: {
        include: {
          user: { select: { id: true, nombre: true, email: true } },
          puesto: { select: { id: true, nombre: true, direccion: true } },
        },
      },
    },
    orderBy: [{ severidad: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json(alertas);
}
