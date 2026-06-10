/**
 * Historial de marcas del guardia.
 *
 * Estado: PLACEHOLDER — se implementará en Sprint Demo 3.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelative, formatTime } from "@/lib/utils";

export default async function HistorialPage() {
  const session = await auth();
  if (!session?.user) return null;

  const marcas = await prisma.marca.findMany({
    where: { userId: session.user.id },
    include: { puesto: true },
    orderBy: { timestampServidor: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Tu historial</h1>
        <p className="mt-1 text-sm text-gray-600">Últimas {marcas.length} marcas</p>
      </header>

      {marcas.length === 0 ? (
        <section className="card text-center text-gray-500">
          <p>Aún no tienes marcas registradas.</p>
        </section>
      ) : (
        <ul className="space-y-2">
          {marcas.map((m) => (
            <li
              key={m.id}
              className={
                "flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 " +
                (m.esFraude ? "ring-danger-200" : "ring-gray-100")
              }
            >
              {/* Thumb */}
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.fotoUrl} alt="" className="h-full w-full object-cover" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {m.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                  </span>
                  <span className="text-xs text-gray-500">{formatTime(m.timestampServidor)}</span>
                </div>
                <p className="truncate text-xs text-gray-600">{m.puesto.nombre}</p>
              </div>

              {/* Estado */}
              <div className="flex-shrink-0">
                {m.esFraude ? (
                  <span className="rounded-full bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger-700">
                    Alerta
                  </span>
                ) : (
                  <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700">
                    OK
                  </span>
                )}
                <p className="mt-1 text-right text-xs text-gray-500">
                  {formatRelative(m.timestampServidor)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
