"use client";

/**
 * MarcaMapaModal — botón "Mapa" + modal con mini-mapa Leaflet embebido
 * mostrando UNA marca individual (entrada, salida o refrigerio).
 *
 * Reemplaza el viejo `<a target="_blank">` que abría Google Maps en otra
 * pestaña. Ahora se ve in-app, con marker distintivo según tipo de marca
 * y opcionalmente con el círculo del geofence del puesto. Como escape
 * hatch, dentro del modal hay un link a Google Maps.
 *
 * Como Leaflet usa `window`/`document`, el contenido del mapa se carga
 * con `next/dynamic` para que no se intente renderizar en el servidor.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { defForTipo, type TipoMarca } from "./MarcaMapaIconos";

const MarcaMapaLeaflet = dynamic(
  () =>
    import("./MarcaMapaLeaflet").then((m) => ({ default: m.MarcaMapaLeaflet })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500">
        Cargando mapa…
      </div>
    ),
  },
);

export interface MarcaModalData {
  tipo: TipoMarca;
  latitud: number;
  longitud: number;
  esFraude?: boolean | null;
  precisionM?: number | null;
  distanciaPuestoM?: number | null;
  fotoUrl?: string | null;
  timestamp?: string;
}

export interface PuestoModalData {
  nombre: string;
  latitud: number;
  longitud: number;
  radioGeofenceM: number;
}

interface Props {
  marca: MarcaModalData;
  puesto?: PuestoModalData | null;
  /** Texto del botón. Si no se pasa, usa "Mapa". */
  buttonLabel?: string;
  /** Si true, el botón es un mini-link (📍 sin texto). Útil dentro de tablas. */
  iconOnly?: boolean;
  /** Clases extra para el botón trigger. */
  className?: string;
}

function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function MarcaMapaModal({
  marca,
  puesto,
  buttonLabel = "Mapa",
  iconOnly = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const def = defForTipo(marca.tipo);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Bloquear scroll del body cuando el modal está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Ver en mapa (${def.human})`}
        aria-label={`Ver ${def.human} en mapa`}
        className={
          className ??
          (iconOnly
            ? "ml-1 inline-flex items-center text-primary-700 hover:text-primary-900"
            : "flex shrink-0 items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-primary-200 hover:bg-primary-100")
        }
      >
        <svg
          className={iconOnly ? "h-3 w-3" : "h-3.5 w-3.5"}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10 18s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
          />
        </svg>
        {!iconOnly && <span>{buttonLabel}</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  background: def.color,
                  color:
                    marca.tipo === "SALIDA_REFRIGERIO" ||
                    marca.tipo === "ENTRADA_REFRIGERIO"
                      ? "#0a0a0a"
                      : "#fff",
                }}
                aria-hidden
              >
                {def.label}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Ubicación de la marca
                </p>
                <p className="truncate text-sm font-bold text-gray-900">
                  {def.human}
                  {marca.timestamp && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ·{" "}
                      {new Date(marca.timestamp).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Mapa */}
            <div className="p-3 sm:p-4">
              <MarcaMapaLeaflet
                marca={marca}
                puesto={puesto ?? null}
                height={420}
              />
            </div>

            {/* Footer con info + escape hatch a Google Maps */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                <span className="tabular-nums">
                  <span className="text-gray-500">Coords:</span>{" "}
                  {marca.latitud.toFixed(5)}, {marca.longitud.toFixed(5)}
                </span>
                {marca.distanciaPuestoM != null && (
                  <span>
                    <span className="text-gray-500">Distancia:</span>{" "}
                    <strong>{Math.round(marca.distanciaPuestoM)}m</strong>
                  </span>
                )}
                {marca.precisionM != null && (
                  <span>
                    <span className="text-gray-500">GPS:</span> ±
                    {Math.round(marca.precisionM)}m
                  </span>
                )}
              </div>
              <a
                href={googleMapsLink(marca.latitud, marca.longitud)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-white px-3 py-1.5 font-medium text-primary-700 ring-1 ring-gray-300 hover:bg-primary-50"
              >
                Abrir en Google Maps →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
