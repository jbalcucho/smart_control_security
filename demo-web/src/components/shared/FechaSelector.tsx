"use client";

/**
 * FechaSelector — barra de filtros de fecha unificada.
 *
 * Pills rápidos: Hoy, Ayer, Últimos 7 días, Últimos 30 días, Este mes, Todas.
 * Custom: dos <input type="date"> (desde / hasta) + botón "Aplicar".
 *
 * Es un Client Component porque los inputs y el botón necesitan estado local,
 * pero los pills se podrían haber hecho con `<Link>`. Los unifico aquí para
 * que el filtro completo se sienta como una sola pieza.
 *
 * Al cambiar el filtro, hace `router.push(basePath + queryString)` y conserva
 * los otros query params que no son del filtro (preserveParams).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { queryStringFor, type RangoFecha } from "@/lib/rango-fecha";
import { cn } from "@/lib/utils";

interface Props {
  /** Ruta base sin query string (ej. "/dashboard"). */
  basePath: string;
  /** Rango actualmente seleccionado (parseado server-side). */
  rangoActual: RangoFecha;
  /** Si false, oculta el pill "Todas". Default true. */
  incluirTodas?: boolean;
  /** Preset oculto: por ejemplo "esteMes" para reportes mensuales. Default todos visibles. */
  presetsOcultos?: Array<"hoy" | "ayer" | "ultimos7" | "ultimos30" | "esteMes">;
}

const PRESETS: { key: "hoy" | "ayer" | "ultimos7" | "ultimos30" | "esteMes"; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "ultimos7", label: "Últimos 7 días" },
  { key: "ultimos30", label: "Últimos 30 días" },
  { key: "esteMes", label: "Este mes" },
];

export function FechaSelector({
  basePath,
  rangoActual,
  incluirTodas = true,
  presetsOcultos = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [desde, setDesde] = useState<string>(rangoActual.desdeIso ?? "");
  const [hasta, setHasta] = useState<string>(rangoActual.hastaIso ?? "");

  // Detecta cuál preset coincide con el rango actual (para resaltarlo).
  const presetActivo = useMemo<string | null>(() => {
    if (rangoActual.modo === "todas") return "todas";
    for (const p of PRESETS) {
      const qs = queryStringFor({ preset: p.key });
      if (qs === rangoActual.queryString) return p.key;
    }
    return null; // custom
  }, [rangoActual]);

  // Otros query params que NO son del filtro (los preservamos).
  const otrosParams = useMemo(() => {
    const p = new URLSearchParams(searchParams);
    p.delete("fecha");
    p.delete("desde");
    p.delete("hasta");
    return p.toString();
  }, [searchParams]);

  const navegar = (queryString: string) => {
    const otros = otrosParams ? (queryString ? `&${otrosParams}` : `?${otrosParams}`) : "";
    router.push(`${basePath}${queryString}${otros}`);
  };

  const aplicarCustom = () => {
    if (!desde || !hasta) return;
    const qs = queryStringFor({ desde, hasta });
    navegar(qs);
  };

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          Periodo:
        </span>
        {PRESETS.filter((p) => !presetsOcultos.includes(p.key)).map((p) => {
          const activo = presetActivo === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => navegar(queryStringFor({ preset: p.key }))}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activo
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200",
              )}
            >
              {p.label}
            </button>
          );
        })}
        {incluirTodas && (
          <button
            type="button"
            onClick={() => navegar(queryStringFor({ preset: "todas" }))}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              presetActivo === "todas"
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
          >
            Todas
          </button>
        )}
      </div>

      {/* Custom range */}
      <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-wide text-gray-500" htmlFor="rango-desde">
            Desde
          </label>
          <input
            id="rango-desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-wide text-gray-500" htmlFor="rango-hasta">
            Hasta
          </label>
          <input
            id="rango-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          />
        </div>
        <button
          type="button"
          onClick={aplicarCustom}
          disabled={!desde || !hasta}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            !desde || !hasta
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : "bg-primary-600 text-white hover:bg-primary-700",
          )}
        >
          Aplicar
        </button>
        <span className="ml-auto text-[11px] text-gray-500">
          Actual: <strong className="text-gray-700">{rangoActual.label}</strong>
        </span>
      </div>
    </section>
  );
}
