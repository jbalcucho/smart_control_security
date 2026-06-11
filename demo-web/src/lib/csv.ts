/**
 * Helpers para generar archivos CSV compatibles con Excel.
 *
 * Pequeños detalles importantes:
 *  - BOM UTF-8 al inicio (\uFEFF) para que Excel detecte la codificación
 *    correctamente y no convierta tildes/ñ en basura.
 *  - Separador `;` por defecto (Excel en es-CO usa coma como decimal y
 *    interpreta `,` como separador de columnas solo si el locale del
 *    sistema es en-US — `;` evita ambigüedades).
 *  - Escape de comillas dobles duplicándolas (`"` → `""`), y envolviendo
 *    cualquier celda que contenga el separador, comillas o saltos de
 *    línea en comillas.
 *  - Saltos de línea CRLF (estándar CSV / RFC 4180).
 */

const DEFAULT_SEP = ";";
const CRLF = "\r\n";

/**
 * Convierte un valor cualquiera en una celda CSV segura.
 */
export function csvCell(value: unknown, sep: string = DEFAULT_SEP): string {
  if (value == null) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === "number") {
    s = Number.isFinite(value) ? String(value) : "";
  } else if (typeof value === "boolean") {
    s = value ? "Sí" : "No";
  } else {
    s = String(value);
  }
  // Si contiene el separador, comillas o salto de línea: envolver y escapar.
  if (s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serializa una matriz de filas (cada fila = arreglo de celdas) a CSV.
 */
export function rowsToCsv(rows: Array<Array<unknown>>, sep: string = DEFAULT_SEP): string {
  return rows.map((row) => row.map((c) => csvCell(c, sep)).join(sep)).join(CRLF);
}

/**
 * Construye un CSV multi-sección. Cada sección puede tener un título y un
 * conjunto de filas; entre secciones se inserta una línea en blanco.
 *
 * Resultado: BOM + secciones unidas por una línea vacía + CRLF final.
 */
export interface CsvSection {
  title?: string;
  rows: Array<Array<unknown>>;
}

export function buildCsv(sections: CsvSection[], sep: string = DEFAULT_SEP): string {
  const parts: string[] = [];
  for (const sec of sections) {
    if (sec.title) {
      parts.push(csvCell(sec.title, sep));
    }
    parts.push(rowsToCsv(sec.rows, sep));
  }
  return `\uFEFF${parts.join(CRLF + CRLF)}${CRLF}`;
}

/**
 * Construye un nombre de archivo "seguro" (sin tildes raras, espacios →
 * guion bajo, sin caracteres ilegales para Windows/macOS).
 */
export function safeFilename(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // quita diacríticos
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

/**
 * Devuelve los headers HTTP estándar para servir un CSV como descarga.
 */
export function csvResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${safeFilename(filename)}.csv"`,
    "Cache-Control": "no-store",
  };
}
