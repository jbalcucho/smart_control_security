/**
 * FechaSelector — pills navegables alrededor de una fecha (o "Todas").
 *
 * Server Component: usa Links normales con query params.
 * Pensado para reutilizarse en /dashboard y /guardias/[id]/reporte.
 */

import Link from "next/link";

interface Props {
  /** Ruta base (sin query string) a la cual añadiremos ?fecha=YYYY-MM-DD. */
  basePath: string;
  /** Fecha actualmente seleccionada en formato YYYY-MM-DD. */
  fechaActual: string;
  /** Días hacia atrás desde hoy a mostrar (default 6). */
  diasHaciaAtras?: number;
  /** Días hacia adelante desde hoy (default 0). */
  diasHaciaAdelante?: number;
  /** Si true, agrega un pill "Todas" que limpia el filtro (?fecha=todas). */
  incluirTodas?: boolean;
}

function diasAlrededor(
  hoy: Date,
  atras: number,
  adelante: number,
): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  for (let i = atras; i >= -adelante; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-CO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
    });
  }
  return out;
}

export function FechaSelector({
  basePath,
  fechaActual,
  diasHaciaAtras = 6,
  diasHaciaAdelante = 0,
  incluirTodas = false,
}: Props) {
  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  const dias = diasAlrededor(hoy, diasHaciaAtras, diasHaciaAdelante);

  return (
    <nav className="card flex flex-wrap items-center gap-2 overflow-x-auto">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">
        Fecha:
      </span>
      {dias.map((d) => {
        const activo = d.iso === fechaActual;
        const esHoy = d.iso === hoyIso;
        return (
          <Link
            key={d.iso}
            href={`${basePath}?fecha=${d.iso}`}
            className={
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors " +
              (activo
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200")
            }
          >
            {d.label}
            {esHoy && !activo && (
              <span className="ml-1 text-[9px] text-primary-700">hoy</span>
            )}
          </Link>
        );
      })}
      {incluirTodas && (
        <Link
          href={`${basePath}?fecha=todas`}
          className={
            "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
            (fechaActual === "todas"
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200")
          }
        >
          Todas
        </Link>
      )}
    </nav>
  );
}
