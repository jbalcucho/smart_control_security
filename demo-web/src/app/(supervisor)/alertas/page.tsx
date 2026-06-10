/**
 * Panel de Alertas del Supervisor.
 *
 * Estado: PLACEHOLDER — se implementará en Sprint Demo 4.
 * Mostrará: alertas pendientes con flujo de "atender / resolver".
 */

import { prisma } from "@/lib/prisma";
import { formatRelative } from "@/lib/utils";

export default async function AlertasPage() {
  const alertas = await prisma.alerta.findMany({
    where: { resuelta: false },
    include: {
      marca: { include: { user: true, puesto: true } },
    },
    orderBy: [{ severidad: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Alertas pendientes</h1>
        <p className="mt-1 text-sm text-gray-600">{alertas.length} sin atender</p>
      </header>

      {alertas.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p>No hay alertas pendientes. </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {alertas.map((a) => (
            <li key={a.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (a.severidad === "ALTA"
                          ? "bg-danger-100 text-danger-700"
                          : a.severidad === "MEDIA"
                            ? "bg-warning-100 text-warning-700"
                            : "bg-gray-100 text-gray-700")
                      }
                    >
                      {a.severidad}
                    </span>
                    <span className="text-xs text-gray-500">{a.tipo}</span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-gray-900">{a.mensaje}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {a.marca.user.nombre} · {a.marca.puesto.nombre} ·{" "}
                    {formatRelative(a.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled
                  title="Pendiente: Sprint Demo 4"
                >
                  Atender
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
