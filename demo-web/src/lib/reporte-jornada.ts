/**
 * Cálculo del reporte de jornada (turno) de un guardia para un día dado.
 *
 * Reglas:
 *   - Un "turno" empieza en una marca ENTRADA y termina en la siguiente SALIDA
 *     del mismo guardia. Si no hay SALIDA aún, el turno está "abierto" y
 *     usamos "ahora" como fin tentativo.
 *   - Dentro del turno, los refrigerios son pares de SALIDA_REFRIGERIO →
 *     ENTRADA_REFRIGERIO. Si un refrigerio quedó sin regreso (porque el guardia
 *     cerró el turno directamente con SALIDA), lo cerramos con la hora de la
 *     SALIDA del turno y lo marcamos como `cerradoConSalida = true`.
 *   - El tiempo efectivo trabajado = duración del turno − suma de refrigerios.
 *   - Se admite múltiples turnos por día (caso poco común pero válido).
 */

import type { TipoMarca } from "@prisma/client";

export interface MarcaSimple {
  id: string;
  tipo: TipoMarca;
  timestampServidor: Date;
  latitud: number | null;
  longitud: number | null;
  precisionM: number | null;
  distanciaPuestoM: number | null;
  dentroDelGeofence: boolean | null;
  esFraude: boolean | null;
  fotoUrl: string | null;
}

export interface Refrigerio {
  /** id de la marca SALIDA_REFRIGERIO */
  salidaId: string;
  /** id de la marca ENTRADA_REFRIGERIO (null si quedó cerrado por SALIDA de turno) */
  entradaId: string | null;
  salida: Date;
  /** Hora de regreso real o, en su defecto, la hora de cierre del turno. */
  entrada: Date;
  duracionMs: number;
  /** true si no hubo ENTRADA_REFRIGERIO explícita y se cerró con la SALIDA del turno */
  cerradoConSalida: boolean;
}

export interface Jornada {
  /** id de la marca ENTRADA del turno */
  entradaId: string;
  /** id de la marca SALIDA del turno (null si sigue abierto) */
  salidaId: string | null;
  inicio: Date;
  /** Fin real o, si el turno sigue abierto, "ahora" (timestamp del cálculo). */
  fin: Date;
  abierta: boolean;
  refrigerios: Refrigerio[];
  duracionTurnoMs: number;
  totalRefrigeriosMs: number;
  duracionEfectivaMs: number;
}

export interface ReporteJornada {
  generadoEn: Date;
  desde: Date;
  hasta: Date;
  jornadas: Jornada[];
  totalTurnoMs: number;
  totalRefrigeriosMs: number;
  totalEfectivoMs: number;
}

/**
 * Empareja las marcas en jornadas y refrigerios.
 *
 * Asume que `marcas` viene ordenada ASC por timestampServidor.
 */
export function calcularReporte(
  marcas: MarcaSimple[],
  opts: { desde: Date; hasta: Date; ahora?: Date } = {
    desde: new Date(0),
    hasta: new Date(),
  },
): ReporteJornada {
  const ahora = opts.ahora ?? new Date();
  const jornadas: Jornada[] = [];

  // Estado del walker
  let jornadaActual: Jornada | null = null;
  let refrigerioAbierto: {
    salidaId: string;
    salida: Date;
  } | null = null;

  for (const m of marcas) {
    const t = m.timestampServidor;

    if (m.tipo === "ENTRADA") {
      // Si ya había jornada abierta, la cerramos con su propio fin tentativo
      // (defensivo: no debería pasar si las transiciones están validadas).
      if (jornadaActual) {
        finalizarJornada(jornadaActual, jornadaActual.fin, refrigerioAbierto);
        jornadas.push(jornadaActual);
        refrigerioAbierto = null;
      }
      jornadaActual = {
        entradaId: m.id,
        salidaId: null,
        inicio: t,
        fin: ahora,
        abierta: true,
        refrigerios: [],
        duracionTurnoMs: 0,
        totalRefrigeriosMs: 0,
        duracionEfectivaMs: 0,
      };
    } else if (m.tipo === "SALIDA_REFRIGERIO") {
      if (!jornadaActual) continue; // marca huérfana → ignoramos
      refrigerioAbierto = { salidaId: m.id, salida: t };
    } else if (m.tipo === "ENTRADA_REFRIGERIO") {
      if (!jornadaActual || !refrigerioAbierto) continue;
      jornadaActual.refrigerios.push({
        salidaId: refrigerioAbierto.salidaId,
        entradaId: m.id,
        salida: refrigerioAbierto.salida,
        entrada: t,
        duracionMs: t.getTime() - refrigerioAbierto.salida.getTime(),
        cerradoConSalida: false,
      });
      refrigerioAbierto = null;
    } else if (m.tipo === "SALIDA") {
      if (!jornadaActual) continue;
      jornadaActual.salidaId = m.id;
      finalizarJornada(jornadaActual, t, refrigerioAbierto);
      jornadas.push(jornadaActual);
      jornadaActual = null;
      refrigerioAbierto = null;
    }
  }

  // Cerrar jornada abierta (turno aún activo) usando ahora como fin tentativo
  if (jornadaActual) {
    finalizarJornada(jornadaActual, ahora, refrigerioAbierto);
    jornadas.push(jornadaActual);
  }

  const totalTurnoMs = jornadas.reduce((a, j) => a + j.duracionTurnoMs, 0);
  const totalRefrigeriosMs = jornadas.reduce(
    (a, j) => a + j.totalRefrigeriosMs,
    0,
  );

  return {
    generadoEn: ahora,
    desde: opts.desde,
    hasta: opts.hasta,
    jornadas,
    totalTurnoMs,
    totalRefrigeriosMs,
    totalEfectivoMs: totalTurnoMs - totalRefrigeriosMs,
  };
}

function finalizarJornada(
  j: Jornada,
  fin: Date,
  refrigerioAbierto: { salidaId: string; salida: Date } | null,
): void {
  j.fin = fin;
  j.abierta = j.salidaId == null;

  // Si quedó un refrigerio sin cerrar y la jornada cierra, lo cerramos
  // con la hora final de la jornada (tolerancia al olvido del guardia).
  if (refrigerioAbierto) {
    j.refrigerios.push({
      salidaId: refrigerioAbierto.salidaId,
      entradaId: null,
      salida: refrigerioAbierto.salida,
      entrada: fin,
      duracionMs: fin.getTime() - refrigerioAbierto.salida.getTime(),
      cerradoConSalida: true,
    });
  }

  j.duracionTurnoMs = j.fin.getTime() - j.inicio.getTime();
  j.totalRefrigeriosMs = j.refrigerios.reduce((a, r) => a + r.duracionMs, 0);
  j.duracionEfectivaMs = Math.max(
    0,
    j.duracionTurnoMs - j.totalRefrigeriosMs,
  );
}

// ============================================================
// Helpers de formato (compartidos cliente/servidor)
// ============================================================

/** Formatea una duración en ms como "Xh Ym" o "Ym Zs" para piezas chicas. */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

/** Devuelve "HH:MM" en hora local. */
export function formatHourMinute(d: Date): string {
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
