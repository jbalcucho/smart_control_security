/**
 * Dashboard del Supervisor.
 *
 * Estado: PLACEHOLDER — se implementará en Sprint Demo 4.
 * Mostrará: KPIs + tabla de últimas marcas con polling de 5s.
 */

import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { estadoDesdeUltimaMarca } from "@/lib/estado-guardia";
import { formatDistance, formatDateTime } from "@/lib/utils";

// Cuenta cuántos guardias activos están actualmente en refrigerio.
// Se basa en la última marca del día de cada guardia.
async function contarEnRefrigerio(): Promise<number> {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const guardias = await prisma.user.findMany({
    where: { rol: "GUARDIA", activo: true },
    select: {
      id: true,
      marcas: {
        where: { timestampServidor: { gte: inicioHoy } },
        orderBy: { timestampServidor: "desc" },
        take: 1,
        select: { id: true, tipo: true, timestampServidor: true },
      },
    },
  });
  let total = 0;
  for (const g of guardias) {
    if (estadoDesdeUltimaMarca(g.marcas[0] ?? null) === "EN_REFRIGERIO") {
      total++;
    }
  }
  return total;
}

export default async function DashboardPage() {
  const [
    totalMarcas,
    totalFraudes,
    totalAlertasPendientes,
    novedadesPendientes,
    novedadesPanico,
    enRefrigerio,
    marcas,
  ] = await Promise.all([
    prisma.marca.count(),
    prisma.marca.count({ where: { esFraude: true } }),
    prisma.alerta.count({ where: { resuelta: false } }),
    prisma.novedad.count({ where: { estado: "PENDIENTE" } }),
    prisma.novedad.count({ where: { estado: "PENDIENTE", tipo: "PANICO" } }),
    contarEnRefrigerio(),
    prisma.marca.findMany({
      include: { user: true, puesto: true, alerta: true },
      orderBy: { timestampServidor: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Resumen general de marcas y alertas
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Marcas totales</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{totalMarcas}</p>
        </div>

        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Fraudes detectados</p>
          <p className="mt-2 text-3xl font-bold text-danger-600">{totalFraudes}</p>
        </div>

        <div className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Alertas pendientes</p>
          <p className="mt-2 text-3xl font-bold text-warning-600">{totalAlertasPendientes}</p>
        </div>

        <Link
          href="/guardias"
          className={
            "card transition-colors hover:bg-gray-50 " +
            (enRefrigerio > 0 ? "bg-accent-50 ring-accent-400/40" : "")
          }
          title="Ver guardias y sus reportes"
        >
          <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1">
            <span aria-hidden>🍽️</span> En refrigerio
          </p>
          <p
            className={
              "mt-2 text-3xl font-bold tabular-nums " +
              (enRefrigerio > 0 ? "text-accent-700" : "text-gray-900")
            }
          >
            {enRefrigerio}
          </p>
        </Link>

        <div
          className={
            novedadesPendientes > 0
              ? "card bg-warning-50 ring-warning-500/30"
              : "card"
          }
        >
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Novedades pendientes
          </p>
          <p
            className={
              "mt-2 text-3xl font-bold tabular-nums " +
              (novedadesPendientes > 0 ? "text-warning-700" : "text-gray-900")
            }
          >
            {novedadesPendientes}
          </p>
        </div>

        <div
          className={
            novedadesPanico > 0
              ? "card bg-danger-50 ring-danger-300 animate-pulse"
              : "card"
          }
        >
          <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1">
            <span aria-hidden>🚨</span> Pánico activo
          </p>
          <p
            className={
              "mt-2 text-3xl font-bold tabular-nums " +
              (novedadesPanico > 0 ? "text-danger-700" : "text-gray-900")
            }
          >
            {novedadesPanico}
          </p>
        </div>
      </div>

      {/* Tabla de últimas marcas */}
      <div className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Últimas 20 marcas</h2>
          <Link
            href="/guardias"
            className="text-xs font-medium text-primary-700 hover:underline"
          >
            Ver todos los guardias →
          </Link>
        </div>

        {marcas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay marcas todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Guardia</th>
                <th className="pb-2">Puesto</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Distancia</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Cuándo</th>
                <th className="pb-2 text-right">Reporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {marcas.map((m) => (
                <tr key={m.id} className="text-gray-700">
                  <td className="py-3 font-medium">{m.user.nombre}</td>
                  <td className="py-3">{m.puesto.nombre}</td>
                  <td className="py-3">
                    <TipoMarcaBadge tipo={m.tipo} />
                  </td>
                  <td className="py-3 tabular-nums">{formatDistance(m.distanciaPuestoM)}</td>
                  <td className="py-3">
                    {m.esFraude ? (
                      <span className="rounded-full bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger-700">
                        Fraude
                      </span>
                    ) : (
                      <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700">
                        Válida
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-xs text-gray-500">
                    {formatDateTime(m.timestampServidor)}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/guardias/${m.user.id}/reporte`}
                      className="text-xs font-medium text-primary-700 hover:underline"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
}

function TipoMarcaBadge({
  tipo,
}: {
  tipo: "ENTRADA" | "SALIDA" | "SALIDA_REFRIGERIO" | "ENTRADA_REFRIGERIO";
}) {
  if (tipo === "ENTRADA") {
    return (
      <span className="rounded bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
        Entrada
      </span>
    );
  }
  if (tipo === "SALIDA") {
    return (
      <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
        Salida
      </span>
    );
  }
  if (tipo === "SALIDA_REFRIGERIO") {
    return (
      <span className="rounded bg-accent-100 px-2 py-0.5 text-xs text-accent-700">
        🍽️ Sale refrigerio
      </span>
    );
  }
  return (
    <span className="rounded bg-accent-50 px-2 py-0.5 text-xs text-accent-700">
      ✓ Regresa refrigerio
    </span>
  );
}
