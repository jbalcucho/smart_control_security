"use client";

/**
 * BotonRefrigerio — botón de un solo tap para registrar SALIDA_REFRIGERIO o
 * ENTRADA_REFRIGERIO. Flujo:
 *
 *   1. Tap → captura GPS (con fallback al puesto si falla / tarda).
 *   2. POST /api/marcas con tipo correspondiente, sin selfie.
 *   3. Muestra el resultado (duración del refrigerio si es regreso).
 *   4. router.refresh() para que el /home re-derive el estado actual.
 *
 * Diseño UX intencional:
 *   - Sin pasos intermedios (sin wizard ni cámara).
 *   - Optimista: si el GPS tarda > 4s, se envía igual (servidor hace fallback
 *     a las coords del puesto).
 *   - El usuario ve un spinner durante el envío y una confirmación efímera.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { formatDuration } from "@/lib/reporte-jornada";

const SUCCESS_AUTO_RESET_MS = 2200;

type Variante = "salida" | "regreso";

interface Props {
  variante: Variante;
  /** Coordenadas del puesto, usadas como fallback si el GPS del navegador falla. */
  fallbackLat: number;
  fallbackLng: number;
  /** Hora de la última SALIDA_REFRIGERIO (solo para variante=regreso) — muestra "vas X tiempo fuera". */
  refrigerioDesde?: Date | null;
}

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; duracionMs: number | null }
  | { kind: "error"; message: string };

const GPS_TIMEOUT_MS = 4000;

function getPositionPromise(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, GPS_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        resolve(pos);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: GPS_TIMEOUT_MS },
    );
  });
}

export function BotonRefrigerio({
  variante,
  fallbackLat,
  fallbackLng,
  refrigerioDesde,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  // Tras un éxito breve, devolvemos al guardia al "menú principal" del /home:
  // refrescamos los Server Components (re-deriva el estado actual y reorganiza
  // las acciones disponibles) y reseteamos el botón a idle. Como ya estamos
  // dentro de /home no hace falta router.push.
  useEffect(() => {
    if (state.kind !== "success") return;
    const t = setTimeout(() => {
      setState({ kind: "idle" });
      router.refresh();
    }, SUCCESS_AUTO_RESET_MS);
    return () => clearTimeout(t);
  }, [state.kind, router]);

  const enviar = useCallback(async () => {
    setState({ kind: "sending" });

    const pos = await getPositionPromise();
    const tipo =
      variante === "salida" ? "SALIDA_REFRIGERIO" : "ENTRADA_REFRIGERIO";

    const payload = {
      tipo,
      latitud: pos?.coords.latitude ?? fallbackLat,
      longitud: pos?.coords.longitude ?? fallbackLng,
      precisionM: pos?.coords.accuracy ?? 9999, // marca "muy aproximado" cuando viene del puesto
      timestampCliente: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      const duracionMs =
        variante === "regreso" && refrigerioDesde
          ? Date.now() - new Date(refrigerioDesde).getTime()
          : null;
      setState({ kind: "success", duracionMs });
      // Nota: el router.refresh() lo hace el useEffect tras 2.2s para que el
      // guardia alcance a ver el banner de éxito antes de que las acciones
      // del /home se reorganicen al nuevo estado.
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      setState({ kind: "error", message });
    }
  }, [variante, fallbackLat, fallbackLng, refrigerioDesde]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  if (state.kind === "success") {
    return (
      <div className="rounded-2xl bg-success-600 p-4 text-white shadow-lg animate-slide-up">
        <p className="text-sm font-bold">
          {variante === "salida"
            ? "Salida de refrigerio registrada"
            : "Regreso de refrigerio registrado"}
        </p>
        {state.duracionMs != null && (
          <p className="mt-1 text-xs text-white/85">
            Duración del refrigerio: {formatDuration(state.duracionMs)}
          </p>
        )}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-2 rounded-2xl bg-danger-50 p-4 ring-1 ring-danger-200">
        <p className="text-sm font-semibold text-danger-700">
          No se pudo registrar
        </p>
        <p className="text-xs text-danger-700">{state.message}</p>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="text-xs font-medium text-danger-700 underline"
        >
          Cerrar
        </button>
      </div>
    );
  }

  const labelTitulo =
    variante === "salida" ? "Salir a refrigerio" : "Regresar de refrigerio";
  const labelSubtitulo =
    variante === "salida"
      ? "Registra la hora de salida (un tap)"
      : "Registra la hora de regreso";
  const colorBase =
    variante === "salida"
      ? "bg-accent-400 hover:bg-accent-500 text-brand-dark"
      : "bg-success-600 hover:bg-success-700 text-white";

  return (
    <button
      type="button"
      onClick={enviar}
      disabled={state.kind === "sending"}
      className={`flex w-full items-center gap-3 rounded-2xl ${colorBase} px-4 py-4 shadow-md transition-transform active:scale-[0.98] disabled:opacity-70`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
          variante === "salida" ? "bg-white/30" : "bg-white/20"
        } text-xl`}
        aria-hidden
      >
        {state.kind === "sending" ? (
          <svg
            className="h-6 w-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx={12} cy={12} r={10} className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" />
          </svg>
        ) : (
          <span>{variante === "salida" ? "🍽️" : "✓"}</span>
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-base font-bold">{labelTitulo}</p>
        <p className="text-xs opacity-80">{labelSubtitulo}</p>
      </div>
    </button>
  );
}
