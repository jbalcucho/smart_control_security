/**
 * ReporteJornadaView — visualización del reporte de jornada de un guardia.
 *
 * Reusado por:
 *   - /mi-reporte (vista del propio guardia)
 *   - /guardias/[id]/reporte (vista del supervisor)
 *
 * Renderiza:
 *   - Encabezado con datos del guardia + fecha + KPIs de totales del día
 *   - Una tarjeta por jornada con: hora inicio, hora fin, duración, tabla de refrigerios
 *   - Cada refrigerio: # | salida | regreso | duración + flag si quedó cerrado por SALIDA
 *
 * Recibe el JSON tal como lo devuelve /api/guardias/[id]/reporte.
 */

import {
  formatDuration,
  formatHourMinute,
  type Jornada,
  type ReporteJornada,
} from "@/lib/reporte-jornada";

interface ReporteApiResponse {
  guardia: {
    id: string;
    nombre: string;
    email: string;
    turnoNombre: string | null;
    turnoInicio: string | null;
    turnoFin: string | null;
    puesto: { id: string; nombre: string; direccion: string } | null;
  };
  fecha: string;
  reporte: ReporteJornadaSerialized;
}

type ReporteJornadaSerialized = Omit<
  ReporteJornada,
  "generadoEn" | "desde" | "hasta" | "jornadas"
> & {
  generadoEn: string;
  desde: string;
  hasta: string;
  jornadas: JornadaSerialized[];
};

type JornadaSerialized = Omit<Jornada, "inicio" | "fin" | "refrigerios"> & {
  inicio: string;
  fin: string;
  refrigerios: Array<{
    salidaId: string;
    entradaId: string | null;
    salida: string;
    entrada: string;
    duracionMs: number;
    cerradoConSalida: boolean;
  }>;
};

interface Props {
  data: ReporteApiResponse;
  /** Si es true, muestra el bloque con email + puesto del guardia (vista supervisor). */
  mostrarPerfil?: boolean;
}

export function ReporteJornadaView({ data, mostrarPerfil = false }: Props) {
  const { guardia, fecha, reporte } = data;
  const fechaLabel = new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Encabezado opcional con datos del guardia */}
      {mostrarPerfil && (
        <section className="card">
          <p className="text-xs uppercase tracking-wide text-gray-500">Guardia</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">
            {guardia.nombre}
          </h2>
          <p className="text-xs text-gray-500">{guardia.email}</p>
          {guardia.puesto && (
            <p className="mt-2 text-sm text-gray-700">
              <span className="text-gray-500">Puesto: </span>
              <strong>{guardia.puesto.nombre}</strong>{" "}
              <span className="text-xs text-gray-500">
                ({guardia.puesto.direccion})
              </span>
            </p>
          )}
          {guardia.turnoNombre && (
            <p className="mt-1 text-sm text-gray-700">
              <span className="text-gray-500">Turno: </span>
              <strong>{guardia.turnoNombre}</strong>{" "}
              <span className="text-xs text-gray-500">
                {guardia.turnoInicio}–{guardia.turnoFin}
              </span>
            </p>
          )}
        </section>
      )}

      {/* Encabezado con fecha + KPIs */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Reporte de jornada
            </p>
            <p className="mt-1 text-base font-semibold capitalize text-gray-900">
              {fechaLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <KpiBox
            label="Tiempo en turno"
            value={formatDuration(reporte.totalTurnoMs)}
            tone="primary"
          />
          <KpiBox
            label="Refrigerios"
            value={formatDuration(reporte.totalRefrigeriosMs)}
            tone="accent"
            icon="🍽️"
          />
          <KpiBox
            label="Efectivo trabajado"
            value={formatDuration(reporte.totalEfectivoMs)}
            tone="success"
          />
        </div>
      </section>

      {/* Jornadas */}
      {reporte.jornadas.length === 0 ? (
        <section className="card text-center">
          <p className="py-6 text-sm text-gray-500">
            No hay actividad registrada para este día.
          </p>
        </section>
      ) : (
        reporte.jornadas.map((j, i) => (
          <JornadaCard key={j.entradaId} jornada={j} index={i + 1} />
        ))
      )}
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function JornadaCard({
  jornada,
  index,
}: {
  jornada: JornadaSerialized;
  index: number;
}) {
  const inicio = new Date(jornada.inicio);
  const fin = new Date(jornada.fin);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Jornada #{index}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">
            {formatHourMinute(inicio)}{" "}
            <span className="text-gray-400">→</span>{" "}
            {jornada.abierta ? (
              <span className="text-primary-700">
                en curso ({formatHourMinute(fin)})
              </span>
            ) : (
              formatHourMinute(fin)
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">
            Duración
          </p>
          <p className="text-sm font-bold tabular-nums text-gray-900">
            {formatDuration(jornada.duracionTurnoMs)}
          </p>
        </div>
      </div>

      {/* Refrigerios */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Refrigerios
          </p>
          <p className="text-[11px] text-gray-500">
            Total: <strong>{formatDuration(jornada.totalRefrigeriosMs)}</strong>{" "}
            ·{" "}
            <span className="text-success-700">
              efectivo {formatDuration(jornada.duracionEfectivaMs)}
            </span>
          </p>
        </div>

        {jornada.refrigerios.length === 0 ? (
          <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Sin refrigerios en esta jornada.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-2">#</th>
                  <th className="pb-1.5 pr-2">Salida</th>
                  <th className="pb-1.5 pr-2">Regreso</th>
                  <th className="pb-1.5 text-right">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jornada.refrigerios.map((r, idx) => (
                  <tr key={r.salidaId} className="text-gray-700">
                    <td className="py-2 pr-2 font-medium tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">
                      {formatHourMinute(new Date(r.salida))}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">
                      {formatHourMinute(new Date(r.entrada))}
                      {r.cerradoConSalida && (
                        <span
                          className="ml-1 rounded bg-warning-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning-700"
                          title="No se registró el regreso; se cerró con la salida del turno"
                        >
                          auto
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums text-gray-900">
                      {formatDuration(r.duracionMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function KpiBox({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "accent";
  icon?: string;
}) {
  const palette = {
    primary: "bg-primary-50 text-primary-700",
    success: "bg-success-50 text-success-700",
    accent: "bg-accent-50 text-accent-700",
  } as const;
  return (
    <div className={`rounded-xl px-3 py-3 ${palette[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
