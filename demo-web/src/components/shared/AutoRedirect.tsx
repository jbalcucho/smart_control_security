"use client";

/**
 * AutoRedirect — al montar dispara un countdown que, al llegar a cero,
 * navega automáticamente a `to`. El usuario puede cancelarlo con un botón.
 *
 * Pensado para mostrarse después de una acción exitosa (marca registrada,
 * novedad enviada, etc.) y devolver al guardia al menú principal sin que
 * tenga que tocar nada.
 *
 * Render: una mini-barra con texto "Volviendo al inicio en Ns..." + botón
 * "Quedarse aquí" para cancelar el redirect.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  to: string;
  /** Duración del countdown en ms (default 3000) */
  delayMs?: number;
  /** Texto descriptivo opcional sobre a dónde se va (default "al inicio") */
  destinoLabel?: string;
  /** Si en lugar de push se prefiere refresh + ejecutar callback (usado dentro del /home). */
  onComplete?: () => void;
}

export function AutoRedirect({
  to,
  delayMs = 3000,
  destinoLabel = "al inicio",
  onComplete,
}: Props) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState(delayMs);
  const [cancelled, setCancelled] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cancelled) return;
    const started = Date.now();
    intervalRef.current = setInterval(() => {
      const left = Math.max(0, delayMs - (Date.now() - started));
      setRemainingMs(left);
    }, 100);
    timeoutRef.current = setTimeout(() => {
      if (onComplete) onComplete();
      else router.push(to);
    }, delayMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [cancelled, delayMs, onComplete, router, to]);

  const cancel = () => {
    setCancelled(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  if (cancelled) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 ring-1 ring-gray-200">
        <span>Redirección cancelada.</span>
      </div>
    );
  }

  const seconds = Math.ceil(remainingMs / 1000);
  const percent = Math.max(0, Math.min(100, (remainingMs / delayMs) * 100));

  return (
    <div className="space-y-2 rounded-xl bg-primary-50 px-3 py-2.5 ring-1 ring-primary-200">
      <div className="flex items-center justify-between text-xs">
        <span className="text-primary-700">
          Volviendo {destinoLabel} en{" "}
          <strong className="tabular-nums">{seconds}s</strong>…
        </span>
        <button
          type="button"
          onClick={cancel}
          className="rounded-md px-2 py-0.5 text-[11px] font-medium text-primary-700 underline hover:text-primary-900"
        >
          Quedarse aquí
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-primary-200/50">
        <div
          className="h-full bg-primary-600 transition-[width] duration-100 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
