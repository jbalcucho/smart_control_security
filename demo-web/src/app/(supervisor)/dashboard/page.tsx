/**
 * Dashboard del Supervisor.
 *
 * Estado: PLACEHOLDER — se implementará en Sprint Demo 4.
 * Mostrará: KPIs + tabla de últimas marcas con polling de 5s.
 */

import { prisma } from "@/lib/prisma";
import { formatDistance, formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const [totalMarcas, totalFraudes, totalAlertasPendientes, marcas] = await Promise.all([
    prisma.marca.count(),
    prisma.marca.count({ where: { esFraude: true } }),
    prisma.alerta.count({ where: { resuelta: false } }),
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>

      {/* Tabla de últimas marcas */}
      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Últimas 20 marcas</h2>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {marcas.map((m) => (
                <tr key={m.id} className="text-gray-700">
                  <td className="py-3 font-medium">{m.user.nombre}</td>
                  <td className="py-3">{m.puesto.nombre}</td>
                  <td className="py-3">
                    <span
                      className={
                        m.tipo === "ENTRADA"
                          ? "rounded bg-primary-100 px-2 py-0.5 text-xs text-primary-700"
                          : "rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700"
                      }
                    >
                      {m.tipo}
                    </span>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Auto-refresh cada 5 segundos (pendiente — Sprint Demo 4)
        </p>
      </div>
    </div>
  );
}
