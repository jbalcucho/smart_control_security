/**
 * Panel de Alertas del Supervisor.
 *
 * Server Component que precarga las alertas pendientes (Marca + Novedad)
 * y delega el render + auto-refresh a <AlertasList /> (client component).
 */

import { prisma } from "@/lib/prisma";
import { AlertasList, type AlertaListItem } from "@/components/supervisor/AlertasList";

const POLL_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MS ?? 5000);

export default async function AlertasPage() {
  const alertas = await prisma.alerta.findMany({
    where: { resuelta: false },
    include: {
      marca: {
        include: {
          user: { select: { id: true, nombre: true, email: true } },
          puesto: { select: { id: true, nombre: true } },
        },
      },
      novedad: {
        include: {
          user: { select: { id: true, nombre: true, email: true } },
          puesto: { select: { id: true, nombre: true, direccion: true } },
        },
      },
    },
    orderBy: [{ severidad: "desc" }, { createdAt: "desc" }],
  });

  // Adaptamos a la forma serializada que espera el client component.
  const initial: AlertaListItem[] = alertas.map((a) => ({
    id: a.id,
    tipo: a.tipo,
    severidad: a.severidad,
    mensaje: a.mensaje,
    resuelta: a.resuelta,
    createdAt: a.createdAt.toISOString(),
    marca: a.marca
      ? {
          id: a.marca.id,
          user: a.marca.user,
          puesto: { id: a.marca.puesto.id, nombre: a.marca.puesto.nombre },
        }
      : null,
    novedad: a.novedad
      ? {
          id: a.novedad.id,
          tipo: a.novedad.tipo,
          descripcion: a.novedad.descripcion,
          refuerzosNecesarios: a.novedad.refuerzosNecesarios,
          latitud: a.novedad.latitud,
          longitud: a.novedad.longitud,
          user: a.novedad.user,
          puesto: a.novedad.puesto,
        }
      : null,
  }));

  return <AlertasList initial={initial} pollMs={POLL_MS} />;
}
