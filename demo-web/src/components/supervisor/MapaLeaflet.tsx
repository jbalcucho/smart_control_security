"use client";

/**
 * MapaLeaflet — componente real del mapa (Leaflet + React-Leaflet).
 *
 * IMPORTANTE: este archivo NO debe importarse directamente desde un
 * Server Component porque usa `window`. Se carga via dynamic import
 * en MapaSupervisor.tsx con `ssr: false`.
 *
 * Funcionalidad:
 *   - Marcadores de puestos con círculo del radio de geofence
 *   - Pins de marcas recientes (verde válida, rojo fraude)
 *   - Pins de novedades activas (pánico rojo pulsante, refuerzo naranja, otras gris)
 *   - Toggles para mostrar/ocultar cada capa
 *   - Auto-refresh cada N segundos (default 10s)
 *   - Auto-centrado en el bounding-box de los puestos al cargar
 *   - Popups con info clave + link a Google Maps
 */

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import { cn, formatDistance, formatRelative } from "@/lib/utils";
import {
  defForTipo,
  pinHtmlForMarca,
  type TipoMarca as TipoMarcaIcono,
} from "@/components/shared/MarcaMapaIconos";

import type {
  MapaSnapshot,
  MarcaMapa,
  NovedadMapa,
  PuestoMapa,
} from "./mapa-types";

// ============================================================
// Iconos custom (SVG inline → divIcon)
// ============================================================

function makeIcon(html: string, size = 32): L.DivIcon {
  return L.divIcon({
    className: "scs-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function pinHtml(color: string, label: string, pulse = false): string {
  const pulseClass = pulse ? "scs-pin-pulse" : "";
  return `
    <div class="scs-pin ${pulseClass}" style="background:${color}">
      <span>${label}</span>
    </div>
  `;
}

const ICON_PUESTO = makeIcon(pinHtml("#0284c7", "P"), 30);
const ICON_NOVEDAD_PANICO = makeIcon(pinHtml("#dc2626", "🚨", true), 34);
const ICON_NOVEDAD_REFUERZO = makeIcon(pinHtml("#ea580c", "👥"), 30);
const ICON_NOVEDAD_GENERAL = makeIcon(pinHtml("#6b7280", "ℹ"), 28);

// Cache de iconos de marca por (tipo|fraude) — el HTML se genera con la
// convención compartida `pinHtmlForMarca` para que se vea igual en el
// mapa global y en los modales individuales.
const MARCA_ICON_CACHE = new Map<string, L.DivIcon>();
function marcaIconCached(tipo: TipoMarcaIcono, esFraude: boolean): L.DivIcon {
  const key = `${tipo}|${esFraude ? "fraude" : "ok"}`;
  const cached = MARCA_ICON_CACHE.get(key);
  if (cached) return cached;
  const icon = makeIcon(
    pinHtmlForMarca({ tipo, esFraude, size: 28 }),
    28,
  );
  MARCA_ICON_CACHE.set(key, icon);
  return icon;
}

// ============================================================
// Helpers
// ============================================================

function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function novedadIcon(n: NovedadMapa): L.DivIcon {
  if (n.tipo === "PANICO") return ICON_NOVEDAD_PANICO;
  if (n.tipo === "REFUERZO") return ICON_NOVEDAD_REFUERZO;
  return ICON_NOVEDAD_GENERAL;
}

function marcaIcon(m: MarcaMapa): L.DivIcon {
  return marcaIconCached(m.tipo as TipoMarcaIcono, m.esFraude);
}

function marcaTipoLabel(tipo: MarcaMapa["tipo"]): string {
  return defForTipo(tipo as TipoMarcaIcono).human;
}

// ============================================================
// Sub-componente: FitToBounds (cuando cambian los puestos)
// ============================================================

function FitBounds({ puestos }: { puestos: PuestoMapa[] }) {
  const map = useMap();
  useEffect(() => {
    if (puestos.length === 0) return;
    const bounds = L.latLngBounds(
      puestos.map((p) => [p.latitud, p.longitud] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [puestos, map]);
  return null;
}

// ============================================================
// Componente principal
// ============================================================

interface MapaLeafletProps {
  initial: MapaSnapshot;
  pollMs?: number;
}

interface LayerToggles {
  puestos: boolean;
  geofences: boolean;
  marcasValidas: boolean;
  marcasFraude: boolean;
  novedades: boolean;
}

const DEFAULT_LAYERS: LayerToggles = {
  puestos: true,
  geofences: true,
  marcasValidas: true,
  marcasFraude: true,
  novedades: true,
};

// Fallback de centro (Bogotá) si no hay puestos
const FALLBACK_CENTER: [number, number] = [4.711, -74.0721];
const FALLBACK_ZOOM = 12;

export function MapaLeaflet({ initial, pollMs = 10_000 }: MapaLeafletProps) {
  const [data, setData] = useState<MapaSnapshot>(initial);
  const [layers, setLayers] = useState<LayerToggles>(DEFAULT_LAYERS);
  const [fetching, setFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date>(new Date(initial.generatedAt));
  const knownNovedadIdsRef = useRef<Set<string>>(
    new Set(initial.novedades.map((n) => n.id)),
  );
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // ----------------------------------------------------------
  // Polling
  // ----------------------------------------------------------
  const fetchSnapshot = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/mapa-snapshot", { cache: "no-store" });
      if (!res.ok) return;
      const snapshot = (await res.json()) as MapaSnapshot;

      // Detectar novedades nuevas
      const nuevasNov = snapshot.novedades.filter(
        (n) => !knownNovedadIdsRef.current.has(n.id),
      );
      if (nuevasNov.length > 0) {
        setHighlightIds((prev) => {
          const next = new Set(prev);
          for (const n of nuevasNov) next.add(n.id);
          return next;
        });
        setTimeout(() => {
          setHighlightIds((prev) => {
            const next = new Set(prev);
            for (const n of nuevasNov) next.delete(n.id);
            return next;
          });
        }, 8000);
      }
      knownNovedadIdsRef.current = new Set(snapshot.novedades.map((n) => n.id));
      setData(snapshot);
      setLastFetch(new Date());
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(fetchSnapshot, pollMs);
    return () => clearInterval(id);
  }, [fetchSnapshot, pollMs]);

  // ----------------------------------------------------------
  // KPIs derivados
  // ----------------------------------------------------------
  const counts = useMemo(() => {
    const panico = data.novedades.filter((n) => n.tipo === "PANICO").length;
    const refuerzo = data.novedades.filter((n) => n.tipo === "REFUERZO").length;
    const otrasNov = data.novedades.length - panico - refuerzo;
    const marcasValidas = data.marcas.filter((m) => !m.esFraude).length;
    const marcasFraude = data.marcas.filter((m) => m.esFraude).length;
    return { panico, refuerzo, otrasNov, marcasValidas, marcasFraude };
  }, [data]);

  // ----------------------------------------------------------
  // Marcas/novedades visibles según toggles
  // ----------------------------------------------------------
  const marcasVisibles = useMemo(
    () =>
      data.marcas.filter((m) =>
        m.esFraude ? layers.marcasFraude : layers.marcasValidas,
      ),
    [data.marcas, layers.marcasFraude, layers.marcasValidas],
  );

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  const firstPuesto = data.puestos[0];
  const initialCenter: [number, number] = firstPuesto
    ? [firstPuesto.latitud, firstPuesto.longitud]
    : FALLBACK_CENTER;

  return (
    <div className="space-y-3">
      {/* Estilos inline para los pins y el pulse */}
      <style>{`
        .scs-marker { background: transparent !important; border: 0 !important; }
        .scs-pin {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 13px;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          line-height: 1;
        }
        .scs-pin-pulse {
          animation: scs-pulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite;
        }
        @keyframes scs-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7), 0 2px 6px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(220,38,38,0), 0 2px 6px rgba(0,0,0,0.3); }
        }
        .leaflet-container {
          border-radius: 1rem;
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 0.75rem;
        }
      `}</style>

      {/* Barra superior: KPIs + estado del polling */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <KpiPill label="Puestos" value={data.puestos.length} color="primary" />
          <KpiPill label="Marcas ✓" value={counts.marcasValidas} color="success" />
          <KpiPill label="Marcas ✗" value={counts.marcasFraude} color="danger" />
          <KpiPill
            label="🚨 Pánico"
            value={counts.panico}
            color="danger"
            pulse={counts.panico > 0}
          />
          <KpiPill label="👥 Refuerzo" value={counts.refuerzo} color="warning" />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              fetching ? "bg-primary-500 animate-pulse" : "bg-success-500",
            )}
            aria-hidden
          />
          Última: {lastFetch.toLocaleTimeString("es-CO", { hour12: false })} · auto cada{" "}
          {Math.round(pollMs / 1000)}s
          <button
            type="button"
            onClick={fetchSnapshot}
            disabled={fetching}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* Toggles de capas */}
      <LayerToggleBar layers={layers} onChange={setLayers} />

      {/* Leyenda de iconos */}
      <Leyenda />

      {/* Contenedor del mapa */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-gray-200">
        <MapContainer
          center={initialCenter}
          zoom={FALLBACK_ZOOM}
          scrollWheelZoom
          style={{ height: "min(70vh, 720px)", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds puestos={data.puestos} />

          {/* Círculos de geofence */}
          {layers.geofences &&
            data.puestos.map((p) => (
              <Circle
                key={`geo-${p.id}`}
                center={[p.latitud, p.longitud]}
                radius={p.radioGeofenceM}
                pathOptions={{
                  color: "#0284c7",
                  weight: 1.5,
                  fillColor: "#38bdf8",
                  fillOpacity: 0.12,
                }}
              />
            ))}

          {/* Puestos */}
          {layers.puestos &&
            data.puestos.map((p) => (
              <Marker key={`p-${p.id}`} position={[p.latitud, p.longitud]} icon={ICON_PUESTO}>
                <Popup>
                  <PuestoPopup puesto={p} />
                </Popup>
              </Marker>
            ))}

          {/* Marcas */}
          {marcasVisibles.map((m) => (
            <Marker key={`m-${m.id}`} position={[m.latitud, m.longitud]} icon={marcaIcon(m)}>
              <Popup>
                <MarcaPopup marca={m} />
              </Popup>
            </Marker>
          ))}

          {/* Novedades con GPS */}
          {layers.novedades &&
            data.novedades.map((n) => (
              <Marker
                key={`n-${n.id}`}
                position={[n.latitud, n.longitud]}
                icon={novedadIcon(n)}
              >
                <Popup>
                  <NovedadPopup novedad={n} isNew={highlightIds.has(n.id)} />
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
}

// ============================================================
// Sub-componentes: KPIs y toggles
// ============================================================

function KpiPill({
  label,
  value,
  color,
  pulse,
}: {
  label: string;
  value: number;
  color: "primary" | "success" | "warning" | "danger";
  pulse?: boolean;
}) {
  const palette = {
    primary: "bg-primary-100 text-primary-700",
    success: "bg-success-100 text-success-700",
    warning: "bg-warning-100 text-warning-700",
    danger: "bg-danger-100 text-danger-700",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        palette[color],
        pulse && "animate-pulse",
      )}
    >
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function Leyenda() {
  // Pequeño helper para reusar el HTML del pin como vista estática.
  const tipos: TipoMarcaIcono[] = [
    "ENTRADA",
    "SALIDA",
    "SALIDA_REFRIGERIO",
    "ENTRADA_REFRIGERIO",
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-2 px-3 text-[11px] ring-1 ring-gray-200">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">
        Leyenda:
      </span>
      {tipos.map((t) => {
        const def = defForTipo(t);
        return (
          <span key={t} className="inline-flex items-center gap-1.5 text-gray-700">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow"
              style={{
                background: def.color,
                color:
                  t === "SALIDA_REFRIGERIO" || t === "ENTRADA_REFRIGERIO"
                    ? "#0a0a0a"
                    : "#fff",
              }}
            >
              {def.label}
            </span>
            {def.human}
          </span>
        );
      })}
      <span className="ml-2 inline-flex items-center gap-1.5 text-gray-700">
        <span
          className="relative inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow"
          style={{ background: "#16a34a", color: "#fff" }}
        >
          ▶
          <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-danger-600 text-[8px] font-black text-white">
            ✗
          </span>
        </span>
        Fraude (borde rojo)
      </span>
    </div>
  );
}

function LayerToggleBar({
  layers,
  onChange,
}: {
  layers: LayerToggles;
  onChange: (l: LayerToggles) => void;
}) {
  const items: { key: keyof LayerToggles; label: string }[] = [
    { key: "puestos", label: "Puestos" },
    { key: "geofences", label: "Geofences" },
    { key: "marcasValidas", label: "Marcas ✓" },
    { key: "marcasFraude", label: "Marcas ✗" },
    { key: "novedades", label: "Novedades" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-gray-200">
      <span className="px-1 text-[11px] uppercase tracking-wide text-gray-500">Capas:</span>
      {items.map((it) => {
        const on = layers[it.key];
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange({ ...layers, [it.key]: !on })}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              on
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Popups
// ============================================================

function PuestoPopup({ puesto }: { puesto: PuestoMapa }) {
  return (
    <div className="min-w-[200px] space-y-1">
      <p className="text-xs uppercase tracking-wide text-gray-500">Puesto</p>
      <p className="text-sm font-semibold text-gray-900">{puesto.nombre}</p>
      <p className="text-xs text-gray-600">{puesto.direccion}</p>
      <p className="text-xs text-gray-500">
        Geofence: <span className="font-medium">{puesto.radioGeofenceM}m</span>
      </p>
      <a
        href={googleMapsLink(puesto.latitud, puesto.longitud)}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs font-medium text-primary-700 hover:underline"
      >
        Abrir en Google Maps →
      </a>
    </div>
  );
}

function MarcaPopup({ marca }: { marca: MarcaMapa }) {
  return (
    <div className="min-w-[220px] space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            marca.esFraude
              ? "bg-danger-100 text-danger-700"
              : "bg-success-100 text-success-700",
          )}
        >
          {marca.esFraude ? "Fuera geofence" : "Válida"}
        </span>
        <span className="text-[10px] uppercase text-gray-500">
          {marcaTipoLabel(marca.tipo)}
        </span>
      </div>
      {/* Foto thumbnail */}
      {marca.fotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={marca.fotoUrl}
          alt={`Selfie de ${marca.user.nombre}`}
          className="block h-24 w-full rounded-lg object-cover"
        />
      )}
      <p className="text-sm font-semibold text-gray-900">{marca.user.nombre}</p>
      <p className="text-xs text-gray-600">{marca.puesto.nombre}</p>
      <p className="text-xs text-gray-500">
        Distancia al puesto:{" "}
        <span className="font-medium tabular-nums">
          {formatDistance(marca.distanciaPuestoM)}
        </span>
      </p>
      <p className="text-xs text-gray-500">
        Precisión GPS: <span className="tabular-nums">±{Math.round(marca.precisionM)}m</span>
      </p>
      <p className="text-xs text-gray-500">
        {formatRelative(new Date(marca.timestampServidor))}
      </p>
    </div>
  );
}

function NovedadPopup({ novedad, isNew }: { novedad: NovedadMapa; isNew: boolean }) {
  const tipoLabel: Record<NovedadMapa["tipo"], { txt: string; cls: string }> = {
    PANICO: { txt: "🚨 PÁNICO", cls: "bg-danger-600 text-white" },
    REFUERZO: { txt: "👥 Refuerzo", cls: "bg-warning-600 text-white" },
    GENERAL: { txt: "Novedad", cls: "bg-gray-200 text-gray-700" },
    INFORMATIVA: { txt: "Info", cls: "bg-gray-100 text-gray-600" },
  };
  const meta = tipoLabel[novedad.tipo];

  return (
    <div className="min-w-[220px] space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            meta.cls,
          )}
        >
          {meta.txt}
        </span>
        {isNew && (
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-700">
            Nueva
          </span>
        )}
        <span className="text-[10px] uppercase text-gray-500">{novedad.estado}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{novedad.user.nombre}</p>
      {novedad.puesto && (
        <p className="text-xs text-gray-600">{novedad.puesto.nombre}</p>
      )}
      {novedad.descripcion && (
        <p className="text-xs italic text-gray-700">"{novedad.descripcion}"</p>
      )}
      {novedad.refuerzosNecesarios && novedad.tipo !== "PANICO" && (
        <p className="text-xs font-medium text-warning-700">Solicita refuerzos</p>
      )}
      <p className="text-xs text-gray-500">
        {novedad.precisionM != null ? (
          <>
            GPS: <span className="tabular-nums">±{Math.round(novedad.precisionM)}m</span>
          </>
        ) : (
          <span className="italic text-warning-700">
            Ubicación aproximada (puesto asignado)
          </span>
        )}
      </p>
      <p className="text-xs text-gray-500">
        {formatRelative(new Date(novedad.timestampServidor))}
      </p>
      <a
        href={googleMapsLink(novedad.latitud, novedad.longitud)}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs font-medium text-primary-700 hover:underline"
      >
        Abrir en Google Maps →
      </a>
    </div>
  );
}
