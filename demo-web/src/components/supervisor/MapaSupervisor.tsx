"use client";

/**
 * MapaSupervisor — wrapper que carga el mapa Leaflet sin SSR.
 *
 * Leaflet usa `window`/`document` directamente y rompería en el servidor,
 * por eso se aísla en MapaLeaflet.tsx y se importa dinámicamente.
 */

import dynamic from "next/dynamic";

import type { MapaSnapshot } from "./mapa-types";

const MapaLeaflet = dynamic(() => import("./MapaLeaflet").then((m) => m.MapaLeaflet), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-2xl bg-gray-100">
      <div className="flex items-center gap-3 text-gray-500">
        <svg
          className="h-5 w-5 animate-spin text-primary-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx={12} cy={12} r={10} className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" />
        </svg>
        <span className="text-sm">Cargando mapa…</span>
      </div>
    </div>
  ),
});

interface MapaSupervisorProps {
  initial: MapaSnapshot;
  pollMs?: number;
  /** Query string (sin `?`) que se reenvía al endpoint `/api/mapa-snapshot`
   *  para preservar el filtro de fecha durante el polling. */
  apiQueryString?: string;
  /** Si está en modo "rango", se muestra una pill arriba del mapa. null = live. */
  rangoLabel?: string | null;
}

export function MapaSupervisor(props: MapaSupervisorProps) {
  return <MapaLeaflet {...props} />;
}
