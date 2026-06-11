"use client";

/**
 * AlertasList — listado de alertas (Marca + Novedad) con auto-refresh.
 *
 * - Hace polling a /api/alertas cada N ms (configurable por prop).
 * - Detecta alertas nuevas entre fetches y las resalta con un ring animado.
 * - Soporta tanto alertas provenientes de Marca (fraude geofence)
 *   como de Novedad (pánico, refuerzo).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn, formatRelative } from "@/lib/utils";

// ============================================================
// Tipos (vienen serializados desde /api/alertas)
// ============================================================

export interface AlertaListItem {
  id: string;
  tipo:
    | "FUERA_GEOFENCE"
    | "FOTO_INVALIDA"
    | "HORARIO_FUERA_TURNO"
    | "GPS_IMPRECISO"
    | "NOVEDAD_PANICO"
    | "NOVEDAD_REFUERZO";
  severidad: "BAJA" | "MEDIA" | "ALTA";
  mensaje: string;
  resuelta: boolean;
  createdAt: string;
  marca: {
    id: string;
    user: { id: string; nombre: string; email: string };
    puesto: { id: string; nombre: string };
  } | null;
  novedad: {
    id: string;
    tipo: "GENERAL" | "REFUERZO" | "PANICO" | "INFORMATIVA";
    descripcion: string;
    refuerzosNecesarios: boolean;
    latitud: number | null;
    longitud: number | null;
    user: { id: string; nombre: string; email: string };
    puesto: { id: string; nombre: string; direccion: string } | null;
  } | null;
}

interface AlertasListProps {
  initial: AlertaListItem[];
  pollMs?: number;
  /** Query string para el fetch de polling (sin `?`). Vacío → "onlyPending=true". */
  apiQueryString?: string;
}

// ============================================================
// Helpers de UI
// ============================================================

function severidadClass(sev: AlertaListItem["severidad"]): string {
  if (sev === "ALTA") return "bg-danger-100 text-danger-700";
  if (sev === "MEDIA") return "bg-warning-100 text-warning-700";
  return "bg-gray-100 text-gray-700";
}

function tipoLabel(tipo: AlertaListItem["tipo"]): { label: string; icon: string; class: string } {
  switch (tipo) {
    case "NOVEDAD_PANICO":
      return { label: "PÁNICO", icon: "🚨", class: "bg-danger-600 text-white" };
    case "NOVEDAD_REFUERZO":
      return { label: "REFUERZOS", icon: "👥", class: "bg-warning-600 text-white" };
    case "FUERA_GEOFENCE":
      return { label: "Fuera geofence", icon: "📍", class: "bg-danger-100 text-danger-700" };
    case "FOTO_INVALIDA":
      return { label: "Foto inválida", icon: "📷", class: "bg-warning-100 text-warning-700" };
    case "HORARIO_FUERA_TURNO":
      return { label: "Fuera de turno", icon: "⏰", class: "bg-warning-100 text-warning-700" };
    case "GPS_IMPRECISO":
      return { label: "GPS impreciso", icon: "📡", class: "bg-gray-100 text-gray-700" };
    default:
      return { label: tipo, icon: "ℹ", class: "bg-gray-100 text-gray-700" };
  }
}

function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ============================================================
// Componente
// ============================================================

export function AlertasList({
  initial,
  pollMs = 5000,
  apiQueryString = "onlyPending=true",
}: AlertasListProps) {
  const [alertas, setAlertas] = useState<AlertaListItem[]>(initial);
  const [lastFetchAt, setLastFetchAt] = useState<Date>(new Date());
  const [fetching, setFetching] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set(initial.map((a) => a.id)));

  // Cuando cambia el filtro server-side (initial cambia), reseteamos el estado.
  useEffect(() => {
    setAlertas(initial);
    knownIdsRef.current = new Set(initial.map((a) => a.id));
    setHighlightedIds(new Set());
  }, [initial]);

  const fetchAlertas = useCallback(async () => {
    setFetching(true);
    try {
      const qs = apiQueryString ? `?${apiQueryString}` : "";
      const res = await fetch(`/api/alertas${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as AlertaListItem[];

      // Detectar nuevas
      const newOnes = data.filter((a) => !knownIdsRef.current.has(a.id));
      if (newOnes.length > 0) {
        setHighlightedIds((prev) => {
          const next = new Set(prev);
          for (const a of newOnes) next.add(a.id);
          return next;
        });
        // Quitar resaltado después de 6s
        setTimeout(() => {
          setHighlightedIds((prev) => {
            const next = new Set(prev);
            for (const a of newOnes) next.delete(a.id);
            return next;
          });
        }, 6000);
      }
      knownIdsRef.current = new Set(data.map((a) => a.id));
      setAlertas(data);
      setLastFetchAt(new Date());
    } finally {
      setFetching(false);
    }
  }, [apiQueryString]);

  useEffect(() => {
    // Cuando cambia `apiQueryString`, `fetchAlertas` se recrea (cambia su
    // identidad), por lo que este efecto se re-ejecuta con el nuevo filtro.
    const id = setInterval(fetchAlertas, pollMs);
    return () => clearInterval(id);
  }, [fetchAlertas, pollMs]);

  // ----------------------------------------------------------
  // Resumen
  // ----------------------------------------------------------
  const { panico, refuerzo, fraude, otras } = useMemo(() => {
    let p = 0,
      r = 0,
      f = 0,
      o = 0;
    for (const a of alertas) {
      if (a.tipo === "NOVEDAD_PANICO") p++;
      else if (a.tipo === "NOVEDAD_REFUERZO") r++;
      else if (a.tipo === "FUERA_GEOFENCE") f++;
      else o++;
    }
    return { panico: p, refuerzo: r, fraude: f, otras: o };
  }, [alertas]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Barra de estado del polling (el título lo provee la página). */}
      <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            fetching ? "bg-primary-500 animate-pulse" : "bg-success-500",
          )}
          aria-hidden
        />
        Última actualización: {lastFetchAt.toLocaleTimeString("es-CO", { hour12: false })}
        <span className="text-gray-400">
          · auto cada {Math.round(pollMs / 1000)}s
        </span>
        <button
          type="button"
          onClick={fetchAlertas}
          disabled={fetching}
          className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Refrescar
        </button>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard label="Pánico" value={panico} variant={panico > 0 ? "danger" : "neutral"} />
        <KpiCard label="Refuerzos" value={refuerzo} variant={refuerzo > 0 ? "warning" : "neutral"} />
        <KpiCard label="Fraude geofence" value={fraude} variant={fraude > 0 ? "danger" : "neutral"} />
        <KpiCard label="Otras" value={otras} variant="neutral" />
      </div>

      {/* Lista */}
      {alertas.length === 0 ? (
        <div className="card text-center text-gray-500">
          <p>No hay alertas pendientes.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {alertas.map((a) => (
            <AlertaRow
              key={a.id}
              alerta={a}
              highlighted={highlightedIds.has(a.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function KpiCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "danger" | "warning" | "neutral";
}) {
  const cls =
    variant === "danger" && value > 0
      ? "border-danger-300 bg-danger-50"
      : variant === "warning" && value > 0
        ? "border-warning-300 bg-warning-50"
        : "border-gray-200 bg-white";
  const valueCls =
    variant === "danger" && value > 0
      ? "text-danger-700"
      : variant === "warning" && value > 0
        ? "text-warning-700"
        : "text-gray-900";
  return (
    <div className={cn("rounded-xl border p-3", cls)}>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", valueCls)}>{value}</p>
    </div>
  );
}

function AlertaRow({
  alerta,
  highlighted,
}: {
  alerta: AlertaListItem;
  highlighted: boolean;
}) {
  const tipo = tipoLabel(alerta.tipo);
  const esPanico = alerta.tipo === "NOVEDAD_PANICO";

  // Nombres pueden venir de marca O de novedad
  const guardia = alerta.marca?.user ?? alerta.novedad?.user;
  const puesto = alerta.marca?.puesto ?? alerta.novedad?.puesto;
  const gpsLat =
    alerta.novedad?.latitud != null ? alerta.novedad.latitud : null;
  const gpsLng =
    alerta.novedad?.longitud != null ? alerta.novedad.longitud : null;

  return (
    <li
      className={cn(
        "card transition-all",
        esPanico && "ring-2 ring-danger-500/40 bg-danger-50/40",
        highlighted &&
          "ring-4 ring-primary-500/60 animate-[pulse_1.4s_ease-in-out_3]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                tipo.class,
              )}
            >
              <span aria-hidden>{tipo.icon}</span>
              {tipo.label}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                severidadClass(alerta.severidad),
              )}
            >
              {alerta.severidad}
            </span>
            {alerta.novedad?.refuerzosNecesarios && !esPanico && (
              <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-700">
                Pide refuerzos
              </span>
            )}
            {highlighted && (
              <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-700">
                Nueva
              </span>
            )}
          </div>

          {/* Mensaje */}
          <p className="mt-2 text-sm font-medium text-gray-900">{alerta.mensaje}</p>

          {/* Descripción de la novedad si aplica */}
          {alerta.novedad?.descripcion &&
            alerta.novedad.descripcion !== alerta.mensaje && (
              <p className="mt-1 text-xs text-gray-600 italic">
                “{alerta.novedad.descripcion}”
              </p>
            )}

          {/* Meta */}
          <p className="mt-1 text-xs text-gray-500">
            {guardia?.nombre ?? "—"}
            {puesto && ` · ${puesto.nombre}`}
            {" · "}
            {formatRelative(new Date(alerta.createdAt))}
          </p>

          {/* Acciones contextuales */}
          {(gpsLat != null && gpsLng != null) && (
            <a
              href={googleMapsLink(gpsLat, gpsLng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 hover:underline"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Ver en mapa
            </a>
          )}
        </div>

        <button
          type="button"
          className="btn-secondary text-xs shrink-0"
          disabled
          title="Próximamente: flujo de atender / resolver alerta"
        >
          Atender
        </button>
      </div>
    </li>
  );
}
