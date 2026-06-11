/**
 * Convención compartida de íconos para representar marcas en cualquier
 * mapa de la app (mapa global del supervisor + modal de marca individual).
 *
 * La forma del pin es un círculo y el color/símbolo interno representa
 * el tipo de marca. Si la marca es fraude, el borde se vuelve rojo y se
 * superpone un ✗.
 *
 * IMPORTANTE: este módulo se importa tanto en Server Components (para
 * tipos / labels) como en Client Components Leaflet (para construir
 * divIcons). Por eso NO importamos Leaflet aquí — solo exportamos
 * primitives (HTML strings + tipos).
 */

export type TipoMarca =
  | "ENTRADA"
  | "SALIDA"
  | "SALIDA_REFRIGERIO"
  | "ENTRADA_REFRIGERIO";

export interface IconoMarcaDef {
  /** Color HEX de fondo del pin */
  color: string;
  /** Texto/emoji a mostrar dentro del pin (1-2 chars) */
  label: string;
  /** Etiqueta humana del tipo */
  human: string;
}

export function defForTipo(tipo: TipoMarca): IconoMarcaDef {
  switch (tipo) {
    case "ENTRADA":
      return { color: "#16a34a", label: "▶", human: "Entrada de turno" };
    case "SALIDA":
      return { color: "#0f172a", label: "■", human: "Salida de turno" };
    case "SALIDA_REFRIGERIO":
      return { color: "#facc15", label: "🍽️", human: "Sale a refrigerio" };
    case "ENTRADA_REFRIGERIO":
      return { color: "#fde047", label: "↩", human: "Regresa de refrigerio" };
  }
}

/**
 * Genera HTML para un pin (usable como `html` de `L.divIcon`).
 * Si `esFraude` es true, se añade un borde rojo grueso y un ✗ superpuesto.
 */
export function pinHtmlForMarca(args: {
  tipo: TipoMarca;
  esFraude?: boolean;
  size?: number;
}): string {
  const { tipo, esFraude = false, size = 32 } = args;
  const d = defForTipo(tipo);
  // Para SALIDA usamos texto blanco; para ENTRADA verde texto blanco; para
  // refrigerios (amarillo) texto negro para contraste; para los emojis los
  // colores no afectan.
  const textColor =
    tipo === "SALIDA_REFRIGERIO" || tipo === "ENTRADA_REFRIGERIO"
      ? "#0a0a0a"
      : "#ffffff";
  const borderColor = esFraude ? "#dc2626" : "rgba(255,255,255,0.95)";
  const borderWidth = esFraude ? 3 : 2;
  const fraudeOverlay = esFraude
    ? `<div style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;background:#dc2626;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.3)">✗</div>`
    : "";
  return `
    <div style="position:relative;width:${size}px;height:${size}px">
      <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${d.color};color:${textColor};font-weight:700;font-size:${size <= 26 ? 12 : 14}px;border:${borderWidth}px solid ${borderColor};border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);line-height:1">
        <span>${d.label}</span>
      </div>
      ${fraudeOverlay}
    </div>
  `;
}
