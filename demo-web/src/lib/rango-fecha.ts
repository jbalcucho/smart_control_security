/**
 * Parser y helpers compartidos para el filtro de fechas usado en
 * /dashboard, /alertas y /guardias/[id]/reporte.
 *
 * Acepta tres formas de query string:
 *   1) ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   → rango explícito
 *   2) ?fecha=YYYY-MM-DD                    → un solo día
 *   3) ?fecha=todas                          → sin filtro
 *   4) sin query                             → según `defaultMode`
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface RangoFecha {
  /** ISO YYYY-MM-DD del inicio (00:00:00 local), null si "todas". */
  desdeIso: string | null;
  /** ISO YYYY-MM-DD del fin (23:59:59 local), null si "todas". */
  hastaIso: string | null;
  /** Date object al inicio del rango, o null si sin filtro. */
  desde: Date | null;
  /** Date object al final del rango (inclusive), o null si sin filtro. */
  hasta: Date | null;
  /** Etiqueta humana ("Hoy", "Ayer", "Últimos 7 días", "12 jun – 18 jun", "Periodo completo"). */
  label: string;
  /** "todas" / "single" / "rango" — útil para resaltar el pill activo en la UI. */
  modo: "todas" | "single" | "rango";
  /** Query string canónico (incluye `?`). Vacío si "todas" y `default = todas`. */
  queryString: string;
}

export interface ParseRangoOpts {
  /** Qué hacer cuando no hay query: "hoy" o "todas". Default "hoy". */
  defaultMode?: "hoy" | "todas";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function fromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * Devuelve etiqueta humana de un rango (intenta detectar Hoy / Ayer / Últimos N días).
 */
function calcularLabel(desdeIso: string, hastaIso: string): string {
  const hoyIso = isoToday();
  if (desdeIso === hastaIso) {
    if (desdeIso === hoyIso) return "Hoy";
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerIso = ayer.toISOString().slice(0, 10);
    if (desdeIso === ayerIso) return "Ayer";
    return fromIso(desdeIso).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }
  // Rango: si termina hoy, etiqueta tipo "Últimos N días"
  if (hastaIso === hoyIso) {
    const desdeMs = fromIso(desdeIso).getTime();
    const hastaMs = fromIso(hastaIso).getTime();
    const dias = Math.round((hastaMs - desdeMs) / 86_400_000) + 1;
    return `Últimos ${dias} días`;
  }
  const d1 = fromIso(desdeIso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
  const d2 = fromIso(hastaIso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
  return `${d1} – ${d2}`;
}

/**
 * Lee los query params crudos y devuelve un RangoFecha estructurado.
 *
 * Acepta:
 *  - { desde, hasta } → rango explícito (rango)
 *  - { fecha: "todas" } → sin filtro (todas)
 *  - { fecha: "YYYY-MM-DD" } → un día (single)
 *  - {} → según defaultMode
 */
export function parseRango(
  params: { fecha?: string; desde?: string; hasta?: string },
  opts: ParseRangoOpts = {},
): RangoFecha {
  const defaultMode = opts.defaultMode ?? "hoy";

  // Rango explícito tiene prioridad
  if (params.desde && params.hasta && ISO_DATE.test(params.desde) && ISO_DATE.test(params.hasta)) {
    // Ordenamos por si vienen invertidos
    const [d, h] = [params.desde, params.hasta].sort();
    return {
      desdeIso: d!,
      hastaIso: h!,
      desde: startOfDay(fromIso(d!)),
      hasta: endOfDay(fromIso(h!)),
      label: calcularLabel(d!, h!),
      modo: d === h ? "single" : "rango",
      queryString: `?desde=${d}&hasta=${h}`,
    };
  }

  if (params.fecha === "todas") {
    return {
      desdeIso: null,
      hastaIso: null,
      desde: null,
      hasta: null,
      label: "Periodo completo",
      modo: "todas",
      queryString: `?fecha=todas`,
    };
  }

  if (params.fecha && ISO_DATE.test(params.fecha)) {
    const iso = params.fecha;
    return {
      desdeIso: iso,
      hastaIso: iso,
      desde: startOfDay(fromIso(iso)),
      hasta: endOfDay(fromIso(iso)),
      label: calcularLabel(iso, iso),
      modo: "single",
      queryString: `?fecha=${iso}`,
    };
  }

  // Sin query → default
  if (defaultMode === "todas") {
    return {
      desdeIso: null,
      hastaIso: null,
      desde: null,
      hasta: null,
      label: "Periodo completo",
      modo: "todas",
      queryString: "",
    };
  }
  const iso = isoToday();
  return {
    desdeIso: iso,
    hastaIso: iso,
    desde: startOfDay(fromIso(iso)),
    hasta: endOfDay(fromIso(iso)),
    label: "Hoy",
    modo: "single",
    queryString: "",
  };
}

/**
 * Construye un query string para un rango / preset dado (útil para los pills).
 */
export function queryStringFor(input: {
  preset?: "hoy" | "ayer" | "ultimos7" | "ultimos30" | "esteMes" | "todas";
  desde?: string;
  hasta?: string;
}): string {
  if (input.preset === "todas") return `?fecha=todas`;

  if (input.preset === "hoy") {
    const iso = isoToday();
    return `?fecha=${iso}`;
  }
  if (input.preset === "ayer") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const iso = d.toISOString().slice(0, 10);
    return `?fecha=${iso}`;
  }
  if (input.preset === "ultimos7" || input.preset === "ultimos30") {
    const n = input.preset === "ultimos7" ? 6 : 29;
    const hoy = new Date();
    const desdeD = new Date(hoy);
    desdeD.setDate(hoy.getDate() - n);
    return `?desde=${desdeD.toISOString().slice(0, 10)}&hasta=${hoy.toISOString().slice(0, 10)}`;
  }
  if (input.preset === "esteMes") {
    const hoy = new Date();
    const desdeD = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return `?desde=${desdeD.toISOString().slice(0, 10)}&hasta=${hoy.toISOString().slice(0, 10)}`;
  }
  if (input.desde && input.hasta) {
    const [d, h] = [input.desde, input.hasta].sort();
    return `?desde=${d}&hasta=${h}`;
  }
  return "";
}
