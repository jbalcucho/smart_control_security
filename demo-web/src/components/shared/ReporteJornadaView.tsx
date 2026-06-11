/**
 * ReporteJornadaView — visualización del reporte de jornada de un guardia.
 *
 * Reusado por:
 *   - /mi-reporte (vista del propio guardia)
 *   - /guardias/[id]/reporte (vista del supervisor)
 *
 * Renderiza:
 *   - Encabezado con datos del guardia + fecha + KPIs de totales del día
 *   - Una tarjeta por jornada con: hora inicio, hora fin, duración, tabla de
 *     refrigerios (con mini-pin de GPS si la marca tiene coords)
 *   - Sección "Marcas del día": lista cronológica con foto (si existe),
 *     distancia, estado y link a Google Maps de cada marca individual.
 *
 * Recibe el JSON tal como lo devuelve /api/guardias/[id]/reporte.
 */

import {
  formatDuration,
  formatHourMinute,
  type Jornada,
  type ReporteJornada,
} from "@/lib/reporte-jornada";

export interface MarcaSerialized {
  id: string;
  tipo: "ENTRADA" | "SALIDA" | "SALIDA_REFRIGERIO" | "ENTRADA_REFRIGERIO";
  timestampServidor: string;
  latitud: number | null;
  longitud: number | null;
  precisionM: number | null;
  distanciaPuestoM: number | null;
  dentroDelGeofence: boolean | null;
  esFraude: boolean | null;
  fotoUrl: string | null;
}

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
  marcas?: MarcaSerialized[];
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

function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function tipoMeta(tipo: MarcaSerialized["tipo"]): {
  label: string;
  icon: string;
  chip: string;
} {
  switch (tipo) {
    case "ENTRADA":
      return {
        label: "Entrada de turno",
        icon: "▶",
        chip: "bg-primary-100 text-primary-700",
      };
    case "SALIDA":
      return {
        label: "Salida de turno",
        icon: "■",
        chip: "bg-gray-200 text-gray-700",
      };
    case "SALIDA_REFRIGERIO":
      return {
        label: "Sale a refrigerio",
        icon: "🍽️",
        chip: "bg-accent-100 text-accent-700",
      };
    case "ENTRADA_REFRIGERIO":
      return {
        label: "Regresa de refrigerio",
        icon: "✓",
        chip: "bg-accent-50 text-accent-700",
      };
  }
}

export function ReporteJornadaView({ data, mostrarPerfil = false }: Props) {
  const { guardia, fecha, reporte, marcas = [] } = data;
  const fechaLabel = new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Index por id para que las jornadas puedan resolver mini-info GPS rápida.
  const marcaById = new Map(marcas.map((m) => [m.id, m]));

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
          <JornadaCard
            key={j.entradaId}
            jornada={j}
            index={i + 1}
            marcaById={marcaById}
          />
        ))
      )}

      {/* Marcas del día (cronológico, con foto + GPS link de cada una) */}
      {marcas.length > 0 && <MarcasDelDia marcas={marcas} />}
    </div>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function JornadaCard({
  jornada,
  index,
  marcaById,
}: {
  jornada: JornadaSerialized;
  index: number;
  marcaById: Map<string, MarcaSerialized>;
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
                {jornada.refrigerios.map((r, idx) => {
                  const salidaMarca = marcaById.get(r.salidaId);
                  const entradaMarca = r.entradaId
                    ? marcaById.get(r.entradaId)
                    : null;
                  return (
                    <tr key={r.salidaId} className="text-gray-700">
                      <td className="py-2 pr-2 font-medium tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        <span>{formatHourMinute(new Date(r.salida))}</span>
                        <MiniGpsLink marca={salidaMarca} />
                      </td>
                      <td className="py-2 pr-2 tabular-nums">
                        <span>{formatHourMinute(new Date(r.entrada))}</span>
                        {r.cerradoConSalida ? (
                          <span
                            className="ml-1 rounded bg-warning-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning-700"
                            title="No se registró el regreso; se cerró con la salida del turno"
                          >
                            auto
                          </span>
                        ) : (
                          <MiniGpsLink marca={entradaMarca} />
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-gray-900">
                        {formatDuration(r.duracionMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function MiniGpsLink({ marca }: { marca: MarcaSerialized | null | undefined }) {
  if (!marca || marca.latitud == null || marca.longitud == null) return null;
  return (
    <a
      href={googleMapsLink(marca.latitud, marca.longitud)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir en Google Maps (${marca.latitud.toFixed(5)}, ${marca.longitud.toFixed(5)})`}
      className="ml-1 inline-flex items-center text-primary-700 hover:text-primary-900"
      aria-label="Ver ubicación en Google Maps"
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10 18s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        />
      </svg>
    </a>
  );
}

// ============================================================
// Marcas del día (lista cronológica con foto + GPS)
// ============================================================

function MarcasDelDia({ marcas }: { marcas: MarcaSerialized[] }) {
  return (
    <section className="card">
      <h3 className="text-sm font-semibold text-gray-900">
        Marcas del día{" "}
        <span className="text-xs font-normal text-gray-500">
          · {marcas.length} {marcas.length === 1 ? "registro" : "registros"}
        </span>
      </h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Foto y ubicación de cada evento (entrada, salida, refrigerios). Toca la
        foto para verla en grande o el pin para abrir Google Maps.
      </p>

      <ul className="mt-3 space-y-2">
        {marcas.map((m) => (
          <MarcaItem key={m.id} marca={m} />
        ))}
      </ul>
    </section>
  );
}

function MarcaItem({ marca }: { marca: MarcaSerialized }) {
  const meta = tipoMeta(marca.tipo);
  const fecha = new Date(marca.timestampServidor);

  return (
    <li
      className={
        "flex items-stretch gap-3 rounded-xl p-2.5 ring-1 " +
        (marca.esFraude
          ? "bg-danger-50 ring-danger-200"
          : "bg-white ring-gray-200")
      }
    >
      {/* Foto / icono */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
        {marca.fotoUrl ? (
          <a
            href={marca.fotoUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver foto en grande"
            className="block h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={marca.fotoUrl}
              alt={`Foto de ${meta.label}`}
              className="h-full w-full object-cover transition-opacity hover:opacity-80"
            />
          </a>
        ) : (
          <span className="text-2xl" aria-hidden>
            {meta.icon}
          </span>
        )}
      </div>

      {/* Info principal */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
              meta.chip
            }
          >
            {meta.label}
          </span>
          <span className="text-xs font-medium tabular-nums text-gray-700">
            {formatHourMinute(fecha)}
          </span>
          {marca.esFraude ? (
            <span className="rounded-full bg-danger-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-danger-700">
              Alerta
            </span>
          ) : marca.dentroDelGeofence ? (
            <span className="rounded-full bg-success-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-success-700">
              Dentro
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
              Fuera
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
          {marca.distanciaPuestoM != null && (
            <span>
              <span className="text-gray-500">Distancia al puesto:</span>{" "}
              <span className="font-medium tabular-nums text-gray-800">
                {Math.round(marca.distanciaPuestoM)}m
              </span>
            </span>
          )}
          {marca.precisionM != null && (
            <span>
              <span className="text-gray-500">GPS:</span>{" "}
              <span className="tabular-nums">±{Math.round(marca.precisionM)}m</span>
            </span>
          )}
          {!marca.fotoUrl && (
            <span className="italic text-gray-500">Sin selfie (refrigerio)</span>
          )}
        </div>
      </div>

      {/* GPS link */}
      {marca.latitud != null && marca.longitud != null && (
        <a
          href={googleMapsLink(marca.latitud, marca.longitud)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200 hover:bg-primary-100"
          title={`Abrir en Google Maps (${marca.latitud.toFixed(5)}, ${marca.longitud.toFixed(5)})`}
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10 18s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
            />
          </svg>
          Mapa
        </a>
      )}
    </li>
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
