"use client";

/**
 * NovedadForm — formulario para que el guardia reporte una novedad NO urgente
 * (incidente, solicitud de refuerzos, registro informativo).
 *
 * Para el botón de pánico ver `BotonPanico.tsx`.
 *
 * Flujo:
 *   1. Selecciona tipo (GENERAL / REFUERZO / INFORMATIVA)
 *   2. Describe (mín 5 caracteres)
 *   3. Marca el toggle "¿necesitas refuerzos?" si aplica
 *   4. Opcional: incluir ubicación GPS (sólo si concede permiso)
 *   5. Enviar → muestra confirmación o error
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// ============================================================
// Tipos
// ============================================================

type TipoSeleccionable = "GENERAL" | "REFUERZO" | "INFORMATIVA";

interface GpsFix {
  latitud: number;
  longitud: number;
  precisionM: number;
}

type GpsState =
  | { kind: "off" }
  | { kind: "requesting" }
  | { kind: "ready"; fix: GpsFix }
  | { kind: "denied"; message: string };

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; novedadId: string; tipo: TipoSeleccionable; alertaCreada: boolean }
  | { kind: "error"; message: string };

interface PuestoInfo {
  id: string;
  nombre: string;
  direccion: string;
}

interface NovedadFormProps {
  puesto: PuestoInfo | null;
}

// ============================================================
// Catálogo de tipos
// ============================================================

const TIPOS: {
  key: TipoSeleccionable;
  label: string;
  hint: string;
  badge: string;
  badgeClass: string;
}[] = [
  {
    key: "GENERAL",
    label: "Incidente / Novedad",
    hint: "Algo fuera de lo normal pero no es emergencia.",
    badge: "Media",
    badgeClass: "bg-warning-100 text-warning-700",
  },
  {
    key: "REFUERZO",
    label: "Solicitar refuerzos",
    hint: "Necesitas apoyo de otro guardia o del supervisor.",
    badge: "Alta",
    badgeClass: "bg-danger-100 text-danger-700",
  },
  {
    key: "INFORMATIVA",
    label: "Informativa",
    hint: "Sólo dejar registro, sin urgencia.",
    badge: "Baja",
    badgeClass: "bg-gray-100 text-gray-700",
  },
];

// ============================================================
// Componente principal
// ============================================================

export function NovedadForm({ puesto }: NovedadFormProps) {
  const [tipo, setTipo] = useState<TipoSeleccionable>("GENERAL");
  const [descripcion, setDescripcion] = useState("");
  const [refuerzosNecesarios, setRefuerzosNecesarios] = useState(false);
  const [gps, setGps] = useState<GpsState>({ kind: "off" });
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  // Si el guardia elige REFUERZO, marcamos el toggle automáticamente.
  useEffect(() => {
    if (tipo === "REFUERZO") setRefuerzosNecesarios(true);
  }, [tipo]);

  // ----------------------------------------------------------
  // GPS opcional (un solo "getCurrentPosition", no watcher)
  // ----------------------------------------------------------
  const watchIdRef = useRef<number | null>(null);

  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGps({ kind: "denied", message: "Este navegador no soporta GPS." });
      return;
    }
    setGps({ kind: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          kind: "ready",
          fix: {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            precisionM: pos.coords.accuracy,
          },
        });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Permiso denegado. La novedad se enviará sin ubicación."
            : "No se pudo obtener la ubicación.";
        setGps({ kind: "denied", message });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }, []);

  const clearGps = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGps({ kind: "off" });
  }, []);

  // ----------------------------------------------------------
  // Validación cliente
  // ----------------------------------------------------------
  const descripcionTrimmed = descripcion.trim();
  const descripcionInvalida = descripcionTrimmed.length < 5;
  const puedeEnviar =
    !descripcionInvalida &&
    submitState.kind !== "sending" &&
    submitState.kind !== "success";

  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------
  const submit = useCallback(async () => {
    if (!puedeEnviar) return;
    setSubmitState({ kind: "sending" });

    const payload: Record<string, unknown> = {
      tipo,
      descripcion: descripcionTrimmed,
      refuerzosNecesarios,
      timestampCliente: new Date().toISOString(),
    };
    if (gps.kind === "ready") {
      payload.latitud = gps.fix.latitud;
      payload.longitud = gps.fix.longitud;
      payload.precisionM = gps.fix.precisionM;
    }

    try {
      const res = await fetch("/api/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          details?: Record<string, string[]>;
        };
        const detail = err.details
          ? Object.values(err.details).flat().join(" · ")
          : "";
        throw new Error(err.error ?? detail ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as {
        ok: true;
        novedad: { id: string };
        alerta: unknown;
      };
      setSubmitState({
        kind: "success",
        novedadId: data.novedad.id,
        tipo,
        alertaCreada: data.alerta !== null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      setSubmitState({ kind: "error", message });
    }
  }, [descripcionTrimmed, gps, puedeEnviar, refuerzosNecesarios, tipo]);

  const reset = useCallback(() => {
    setTipo("GENERAL");
    setDescripcion("");
    setRefuerzosNecesarios(false);
    setSubmitState({ kind: "idle" });
    setGps({ kind: "off" });
  }, []);

  // ----------------------------------------------------------
  // Pantalla de éxito
  // ----------------------------------------------------------
  if (submitState.kind === "success") {
    return (
      <div className="space-y-3 animate-slide-up">
        <div className="card bg-success-50 ring-success-500/30 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-600 text-white">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-3 text-lg font-bold text-success-700">Novedad enviada</h2>
          <p className="mt-1 text-sm text-gray-600">
            {submitState.alertaCreada
              ? "Tu supervisor recibirá una alerta inmediatamente."
              : "Quedó registrada en el sistema."}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            ID: <span className="font-mono">{submitState.novedadId.slice(0, 8)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/home" className="btn-secondary text-center">
            Volver al inicio
          </Link>
          <button type="button" onClick={reset} className="btn-primary">
            Nueva novedad
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Render principal
  // ----------------------------------------------------------
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4 animate-fade-in"
    >
      {/* Selector de tipo */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Tipo de novedad
        </legend>
        <div className="space-y-2">
          {TIPOS.map((t) => {
            const selected = tipo === t.key;
            return (
              <label
                key={t.key}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  selected
                    ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500/30"
                    : "border-gray-200 bg-white hover:bg-gray-50",
                )}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t.key}
                  checked={selected}
                  onChange={() => setTipo(t.key)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{t.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        t.badgeClass,
                      )}
                    >
                      {t.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">{t.hint}</p>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Descripción */}
      <div>
        <label htmlFor="descripcion" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Descripción <span className="text-danger-600">*</span>
        </label>
        <textarea
          id="descripcion"
          rows={4}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describe lo que está pasando…"
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          maxLength={2000}
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span
            className={cn(
              descripcionInvalida ? "text-danger-600" : "text-gray-500",
            )}
          >
            {descripcionInvalida ? "Mínimo 5 caracteres" : "Listo"}
          </span>
          <span className="text-gray-400 tabular-nums">
            {descripcion.length} / 2000
          </span>
        </div>
      </div>

      {/* Toggle refuerzos */}
      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={refuerzosNecesarios}
          onChange={(e) => setRefuerzosNecesarios(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            ¿Necesitas refuerzos?
          </p>
          <p className="text-xs text-gray-600">
            Si lo marcas, la alerta para tu supervisor sube a severidad alta.
          </p>
        </div>
      </label>

      {/* GPS opcional */}
      <GpsBlock gps={gps} onRequest={requestGps} onClear={clearGps} />

      {/* Puesto asignado (informativo) */}
      {puesto && (
        <div className="card">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Reportando desde</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">{puesto.nombre}</p>
          <p className="text-xs text-gray-500">{puesto.direccion}</p>
        </div>
      )}

      {/* Error */}
      {submitState.kind === "error" && (
        <div className="card bg-danger-50 ring-danger-200">
          <p className="text-sm font-semibold text-danger-700">
            No se pudo enviar la novedad
          </p>
          <p className="mt-1 text-xs text-danger-700">{submitState.message}</p>
        </div>
      )}

      {/* Acciones */}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="submit"
          disabled={!puedeEnviar}
          className={cn(
            "btn-primary",
            !puedeEnviar && "opacity-50 cursor-not-allowed",
          )}
        >
          {submitState.kind === "sending" ? "Enviando…" : "Enviar novedad"}
        </button>
        <Link href="/home" className="btn-secondary text-center">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

// ============================================================
// Bloque GPS (interno)
// ============================================================

function GpsBlock({
  gps,
  onRequest,
  onClear,
}: {
  gps: GpsState;
  onRequest: () => void;
  onClear: () => void;
}) {
  if (gps.kind === "ready") {
    return (
      <div className="card bg-success-50 ring-success-500/30 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-success-700">Ubicación incluida</p>
          <p className="text-xs text-gray-600 tabular-nums">
            {gps.fix.latitud.toFixed(5)}, {gps.fix.longitud.toFixed(5)} (±{Math.round(gps.fix.precisionM)}m)
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          Quitar
        </button>
      </div>
    );
  }

  if (gps.kind === "requesting") {
    return (
      <div className="card flex items-center gap-3">
        <svg className="h-5 w-5 animate-spin text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={12} cy={12} r={10} className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" />
        </svg>
        <p className="text-sm text-gray-700">Obteniendo ubicación…</p>
      </div>
    );
  }

  if (gps.kind === "denied") {
    return (
      <div className="card bg-warning-50 ring-warning-500/30">
        <p className="text-sm font-semibold text-warning-700">
          La novedad se enviará sin GPS
        </p>
        <p className="mt-1 text-xs text-warning-700">{gps.message}</p>
        <button
          type="button"
          onClick={onRequest}
          className="mt-2 text-xs font-semibold text-primary-700 underline hover:text-primary-800"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // off
  return (
    <button
      type="button"
      onClick={onRequest}
      className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Incluir mi ubicación (opcional)</p>
          <p className="text-xs text-gray-500">
            Ayuda al supervisor a llegar al sitio si necesita asistirte.
          </p>
        </div>
      </div>
    </button>
  );
}
