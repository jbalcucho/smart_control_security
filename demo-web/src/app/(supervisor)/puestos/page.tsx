/**
 * Administración de Puestos (vista del supervisor).
 *
 * Lista todos los puestos (activos e inactivos) con conteos de guardias y
 * marcas asociadas, y permite crear, editar y eliminar desde modales.
 */

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  PuestosAdminTable,
  type PuestoRow,
} from "@/components/supervisor/PuestosAdminTable";

export default async function PuestosPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.rol === "GUARDIA") redirect("/home");

  const puestos = await prisma.puesto.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      _count: { select: { guardias: true, marcas: true } },
    },
  });

  const rows: PuestoRow[] = puestos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion,
    latitud: p.latitud,
    longitud: p.longitud,
    radioGeofenceM: p.radioGeofenceM,
    activo: p.activo,
    guardiasCount: p._count.guardias,
    marcasCount: p._count.marcas,
  }));

  const activos = rows.filter((r) => r.activo).length;
  const conGuardias = rows.filter((r) => r.guardiasCount > 0).length;
  const totalMarcas = rows.reduce((a, r) => a + r.marcasCount, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Administrar puestos</h1>
        <p className="mt-1 text-sm text-gray-600">
          Define las ubicaciones físicas donde los guardias deben hacer sus
          marcaciones. El radio del geofence determina cuándo una marca cae
          como sospechosa.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <KpiPill label="Activos" value={activos} tone="primary" />
        <KpiPill label="Con guardias" value={conGuardias} tone="accent" />
        <KpiPill label="Marcas totales" value={totalMarcas} tone="muted" />
      </section>

      <PuestosAdminTable initialRows={rows} />
    </div>
  );
}

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "accent" | "muted";
}) {
  const palette = {
    primary: "bg-primary-50 text-primary-700",
    accent: "bg-accent-50 text-accent-700",
    muted: "bg-gray-100 text-gray-600",
  } as const;
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${palette[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
