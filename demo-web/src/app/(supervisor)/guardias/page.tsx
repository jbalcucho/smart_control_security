/**
 * Lista de guardias para el supervisor.
 *
 * Cada fila muestra estado actual (En turno / En refrigerio / Fuera de turno)
 * y enlaza al reporte de jornada del guardia.
 */

import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { estadoDesdeUltimaMarca, type EstadoGuardia } from "@/lib/estado-guardia";
import { formatHourMinute } from "@/lib/reporte-jornada";

interface GuardiaRow {
  id: string;
  nombre: string;
  email: string;
  puesto: { nombre: string } | null;
  estado: EstadoGuardia;
  desde: Date | null;
}

export default async function GuardiasPage() {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const guardias = await prisma.user.findMany({
    where: { rol: "GUARDIA", activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      email: true,
      puesto: { select: { nombre: true } },
      marcas: {
        where: { timestampServidor: { gte: inicioHoy } },
        orderBy: { timestampServidor: "desc" },
        take: 1,
        select: { id: true, tipo: true, timestampServidor: true },
      },
    },
  });

  const rows: GuardiaRow[] = guardias.map((g) => {
    const ultima = g.marcas[0] ?? null;
    return {
      id: g.id,
      nombre: g.nombre,
      email: g.email,
      puesto: g.puesto,
      estado: estadoDesdeUltimaMarca(ultima),
      desde: ultima?.timestampServidor ?? null,
    };
  });

  const contadores = rows.reduce(
    (acc, r) => {
      acc[r.estado] += 1;
      return acc;
    },
    { EN_TURNO: 0, EN_REFRIGERIO: 0, FUERA_DE_TURNO: 0 } as Record<
      EstadoGuardia,
      number
    >,
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Guardias</h1>
        <p className="mt-1 text-sm text-gray-600">
          Estado actual y acceso al reporte de jornada de cada guardia.
        </p>
      </header>

      {/* Mini-KPIs */}
      <section className="grid grid-cols-3 gap-2">
        <KpiPill label="En turno" value={contadores.EN_TURNO} tone="primary" />
        <KpiPill
          label="🍽️ En refrigerio"
          value={contadores.EN_REFRIGERIO}
          tone="accent"
        />
        <KpiPill label="Fuera" value={contadores.FUERA_DE_TURNO} tone="muted" />
      </section>

      <section className="card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">
            No hay guardias activos registrados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Guardia</th>
                <th className="pb-2">Puesto</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Desde</th>
                <th className="pb-2 text-right">Reporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="text-gray-700">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{r.nombre}</p>
                    <p className="text-xs text-gray-500">{r.email}</p>
                  </td>
                  <td className="py-3">{r.puesto?.nombre ?? "—"}</td>
                  <td className="py-3">
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td className="py-3 text-xs tabular-nums text-gray-600">
                    {r.desde ? formatHourMinute(r.desde) : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/guardias/${r.id}/reporte`}
                      className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                    >
                      Ver reporte →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoGuardia }) {
  if (estado === "EN_TURNO") {
    return (
      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
        En turno
      </span>
    );
  }
  if (estado === "EN_REFRIGERIO") {
    return (
      <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
        🍽️ Refrigerio
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      Fuera
    </span>
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
