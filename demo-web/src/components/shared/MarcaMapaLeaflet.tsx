"use client";

/**
 * MarcaMapaLeaflet — mini-mapa Leaflet para mostrar UNA marca individual
 * dentro del modal. Soporta opcionalmente dibujar el círculo del geofence
 * del puesto y un marker secundario en la posición del puesto.
 *
 * Este archivo NO debe importarse directamente desde un Server Component
 * porque Leaflet usa `window`/`document`. Se carga via `next/dynamic`
 * con `ssr: false` en `MarcaMapaModal`.
 */

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import {
  defForTipo,
  pinHtmlForMarca,
  type TipoMarca,
} from "./MarcaMapaIconos";

export interface MarcaParaMapa {
  tipo: TipoMarca;
  latitud: number;
  longitud: number;
  esFraude?: boolean | null;
  precisionM?: number | null;
  distanciaPuestoM?: number | null;
  fotoUrl?: string | null;
  timestamp?: string;
}

export interface PuestoParaMapa {
  nombre: string;
  latitud: number;
  longitud: number;
  radioGeofenceM: number;
}

interface Props {
  marca: MarcaParaMapa;
  puesto?: PuestoParaMapa | null;
  height?: number | string;
}

function makeIcon(html: string, size: number): L.DivIcon {
  return L.divIcon({
    className: "scs-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const PUESTO_ICON = makeIcon(
  `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#0284c7;color:#fff;font-weight:700;font-size:12px;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);line-height:1">P</div>`,
  24,
);

export function MarcaMapaLeaflet({ marca, puesto, height = 360 }: Props) {
  const def = defForTipo(marca.tipo);
  const icon = makeIcon(
    pinHtmlForMarca({
      tipo: marca.tipo,
      esFraude: marca.esFraude ?? false,
      size: 40,
    }),
    40,
  );

  // Centro y zoom según haya o no puesto: si hay, mostramos ambos y dejamos
  // que el bounds del MapContainer se ajuste a los dos puntos + geofence.
  const center: [number, number] = [marca.latitud, marca.longitud];

  return (
    <div className="relative overflow-hidden rounded-xl ring-1 ring-gray-200">
      <MapContainer
        center={center}
        zoom={17}
        scrollWheelZoom
        style={{ height, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Geofence del puesto (si hay) */}
        {puesto && (
          <>
            <Circle
              center={[puesto.latitud, puesto.longitud]}
              radius={puesto.radioGeofenceM}
              pathOptions={{
                color: "#0284c7",
                weight: 1.5,
                fillColor: "#38bdf8",
                fillOpacity: 0.12,
              }}
            />
            <Marker
              position={[puesto.latitud, puesto.longitud]}
              icon={PUESTO_ICON}
            >
              <Popup>
                <div className="min-w-[160px]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Puesto
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {puesto.nombre}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Geofence: {puesto.radioGeofenceM}m
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Pin de la marca */}
        <Marker position={center} icon={icon}>
          <Popup>
            <div className="min-w-[180px] space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {def.human}
              </p>
              {marca.timestamp && (
                <p className="text-xs font-medium tabular-nums text-gray-700">
                  {new Date(marca.timestamp).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              )}
              {marca.distanciaPuestoM != null && (
                <p className="text-[11px] text-gray-600">
                  Distancia al puesto:{" "}
                  <span className="font-medium tabular-nums">
                    {Math.round(marca.distanciaPuestoM)}m
                  </span>
                </p>
              )}
              {marca.precisionM != null && (
                <p className="text-[11px] text-gray-600">
                  GPS: ±{Math.round(marca.precisionM)}m
                </p>
              )}
              {marca.esFraude && (
                <p className="rounded bg-danger-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger-700">
                  Fuera del geofence
                </p>
              )}
              {marca.fotoUrl && (
                <a
                  href={marca.fotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[11px] font-medium text-primary-700 hover:underline"
                >
                  Ver foto en grande →
                </a>
              )}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
