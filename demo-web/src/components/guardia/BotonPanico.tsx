"use client";

/**
 * BotonPanico — botón rojo de emergencia.
 *
 * Flujo:
 *   1. Tap inicial → abre modal de confirmación con countdown de 3 s.
 *   2. Si el guardia no cancela, se envía POST /api/novedades con tipo=PANICO.
 *   3. En paralelo intentamos capturar el GPS para enriquecer la alerta
 *      (no bloquea el envío: si no hay GPS, igual sale).
 *   4. Muestra confirmación con la opción de "Cancelar / Avisar que fue falsa alarma"
 *      (registra otra novedad INFORMATIVA — futuro).
 *
 * Diseño UX:
 *   - Botón rojo grande para que sea fácil de pulsar bajo estrés.
 *   - Countdown visible y cancelable con un solo tap.
 *   - Sin formulario en el camino crítico (un tap activa, otro confirma).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const COUNTDOWN_SEC = 3;
// Tras el éxito, dejamos el banner visible 4s para que el guardia lea la
// confirmación con calma; luego volvemos al menú principal del /home.
const SUCCESS_AUTO_RESET_MS = 4000;

type State =
  | { kind: "idle" }
  | { kind: "confirming"; remainingMs: number }
  | { kind: "sending" }
  | { kind: "success"; novedadId: string; gpsIncluido: boolean }
  | { kind: "error"; message: string };

export function BotonPanico() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const gpsRef = useRef<{ latitud: number; longitud: number; precisionM: number } | null>(
    null,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-reset al menú principal tras un envío exitoso.
  useEffect(() => {
    if (state.kind !== "success") return;
    const t = setTimeout(() => {
      setState({ kind: "idle" });
      router.refresh();
    }, SUCCESS_AUTO_RESET_MS);
    return () => clearTimeout(t);
  }, [state.kind, router]);

  // ----------------------------------------------------------
  // Limpieza
  // ----------------------------------------------------------
  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // ----------------------------------------------------------
  // Captura de GPS oportunista (no bloquea el envío)
  //
  // Diseño intencional:
  //   - `enableHighAccuracy: false` → primer fix mucho más rápido (red/celdas).
  //     El primer fix de alta precisión típico tarda 10-30s, y nuestro
  //     countdown es de 3s, así que casi nunca llegaría a tiempo. Para el
  //     caso de pánico, conocer la posición aproximada en segundos es mucho
  //     más valioso que conocer la exacta varios minutos después.
  //   - `maximumAge: 120_000` → si el browser tiene una lectura reciente
  //     (de hasta 2 min atrás) la reusa sin pedir un fix nuevo: instantáneo.
  //   - Si el GPS no llega a tiempo, el server-side aplica fallback a las
  //     coords del puesto asignado, así la novedad SIEMPRE aparece en el mapa.
  // ----------------------------------------------------------
  const fetchGpsBest = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsRef.current = {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          precisionM: pos.coords.accuracy,
        };
      },
      () => {
        // ignoramos errores — el pánico sale sin GPS (server hace fallback)
      },
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 8_000 },
    );
  }, []);

  // ----------------------------------------------------------
  // Envío al servidor
  // ----------------------------------------------------------
  const sendPanico = useCallback(async () => {
    clearTimers();
    setState({ kind: "sending" });

    const payload: Record<string, unknown> = {
      tipo: "PANICO",
      descripcion: "Botón de pánico activado por el guardia.",
      refuerzosNecesarios: true,
      timestampCliente: new Date().toISOString(),
    };
    if (gpsRef.current) {
      payload.latitud = gpsRef.current.latitud;
      payload.longitud = gpsRef.current.longitud;
      payload.precisionM = gpsRef.current.precisionM;
    }

    try {
      const res = await fetch("/api/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as { ok: true; novedad: { id: string } };
      setState({
        kind: "success",
        novedadId: data.novedad.id,
        gpsIncluido: gpsRef.current !== null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      setState({ kind: "error", message });
    }
  }, [clearTimers]);

  // ----------------------------------------------------------
  // Acciones
  // ----------------------------------------------------------
  const startCountdown = useCallback(() => {
    // No reseteamos gpsRef: si quedó una lectura previa (ej. el guardia
    // pulsó antes y canceló), la reusamos para no perderla.
    fetchGpsBest(); // dispara GPS en background; puede llegar antes del envío
    const startedAt = Date.now();
    const totalMs = COUNTDOWN_SEC * 1000;
    setState({ kind: "confirming", remainingMs: totalMs });

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, totalMs - elapsed);
      setState({ kind: "confirming", remainingMs: remaining });
    }, 100);

    timeoutRef.current = setTimeout(() => {
      sendPanico();
    }, totalMs);
  }, [fetchGpsBest, sendPanico]);

  const cancel = useCallback(() => {
    clearTimers();
    setState({ kind: "idle" });
    gpsRef.current = null;
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setState({ kind: "idle" });
    gpsRef.current = null;
  }, [clearTimers]);

  // ----------------------------------------------------------
  // Render: botón en estado idle (lo que ve normalmente el guardia)
  // ----------------------------------------------------------
  if (state.kind === "idle") {
    return (
      <button
        type="button"
        onClick={startCountdown}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-danger-600 to-danger-700 px-4 py-4 text-white shadow-lg shadow-danger-600/30 transition-transform active:scale-[0.98]"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40 group-hover:bg-white/30">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"
              />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-base font-bold uppercase tracking-wide">Pánico</p>
            <p className="text-xs text-white/80">
              Avisa de emergencia al supervisor de inmediato
            </p>
          </div>
          <svg
            className="h-5 w-5 text-white/70"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    );
  }

  // ----------------------------------------------------------
  // Render: countdown (modal full screen)
  // ----------------------------------------------------------
  if (state.kind === "confirming") {
    const secondsLeft = Math.ceil(state.remainingMs / 1000);
    const percent = Math.max(0, Math.min(100, (state.remainingMs / (COUNTDOWN_SEC * 1000)) * 100));

    return (
      <PanicoOverlay>
        <div className="space-y-4 text-center text-white animate-fade-in">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/40">
            <svg
              className="h-10 w-10 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Enviando alerta de pánico</h2>
          <p className="text-sm text-white/80 max-w-xs mx-auto">
            Se enviará en <span className="tabular-nums font-bold">{secondsLeft}</span> segundo
            {secondsLeft === 1 ? "" : "s"}. Pulsa cancelar si fue por error.
          </p>

          {/* Barra de progreso */}
          <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-white transition-[width] duration-100 ease-linear"
              style={{ width: `${percent}%` }}
            />
          </div>

          <button
            type="button"
            onClick={cancel}
            className="mx-auto block rounded-full bg-white px-6 py-3 text-base font-bold text-danger-700 shadow-lg active:scale-95 transition-transform"
          >
            Cancelar
          </button>
        </div>
      </PanicoOverlay>
    );
  }

  // ----------------------------------------------------------
  // Render: enviando
  // ----------------------------------------------------------
  if (state.kind === "sending") {
    return (
      <PanicoOverlay>
        <div className="space-y-4 text-center text-white animate-fade-in">
          <svg
            className="mx-auto h-16 w-16 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx={12} cy={12} r={10} className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" />
          </svg>
          <h2 className="text-xl font-bold">Enviando alerta…</h2>
        </div>
      </PanicoOverlay>
    );
  }

  // ----------------------------------------------------------
  // Render: éxito
  // ----------------------------------------------------------
  if (state.kind === "success") {
    return (
      <div className="space-y-3 animate-slide-up rounded-2xl bg-success-600 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold">Alerta enviada</p>
            <p className="text-sm text-white/85">
              Tu supervisor fue notificado{state.gpsIncluido ? " con tu ubicación." : "."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/home"
            className="rounded-lg bg-white/15 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-white/25"
          >
            Volver al inicio
          </Link>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-white px-3 py-2 text-center text-sm font-bold text-success-700"
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Render: error
  // ----------------------------------------------------------
  return (
    <div className="space-y-3 rounded-2xl bg-danger-50 p-4 ring-1 ring-danger-200">
      <p className="text-sm font-semibold text-danger-700">No se pudo enviar la alerta</p>
      <p className="text-xs text-danger-700">
        {state.kind === "error" ? state.message : ""}
      </p>
      <button type="button" onClick={startCountdown} className="btn-primary w-full">
        Reintentar
      </button>
      <button type="button" onClick={reset} className="block w-full text-center text-xs text-gray-500 underline">
        Cerrar
      </button>
    </div>
  );
}

// ============================================================
// Overlay full-screen para countdown / sending
// ============================================================

function PanicoOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-danger-700/95 backdrop-blur-sm p-6">
      {children}
    </div>
  );
}
