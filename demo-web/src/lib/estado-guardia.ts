/**
 * Helpers para derivar el estado actual de un guardia a partir de sus marcas.
 *
 * En el demo NO tenemos una entidad "Turno" persistida: el estado se infiere
 * de la última marca del día (zona horaria del servidor; suficiente para el demo).
 *
 * Estados posibles:
 *   - FUERA_DE_TURNO  → no ha entrado, o ya hizo SALIDA del turno.
 *   - EN_TURNO        → última marca fue ENTRADA o ENTRADA_REFRIGERIO.
 *   - EN_REFRIGERIO   → última marca fue SALIDA_REFRIGERIO.
 *
 * Las transiciones válidas son:
 *   FUERA_DE_TURNO  → ENTRADA                → EN_TURNO
 *   EN_TURNO        → SALIDA_REFRIGERIO      → EN_REFRIGERIO
 *   EN_REFRIGERIO   → ENTRADA_REFRIGERIO     → EN_TURNO
 *   EN_TURNO        → SALIDA                 → FUERA_DE_TURNO
 *
 * Para tolerancia (caso típico: guardia olvida marcar regreso de refrigerio
 * y al final del turno marca SALIDA directamente), también permitimos:
 *   EN_REFRIGERIO   → SALIDA                 → FUERA_DE_TURNO
 *     (el refrigerio queda "abierto" en el reporte; se cuenta con el cierre
 *      de turno como hora de regreso para no perder el tiempo registrado).
 */

import { prisma } from "@/lib/prisma";
import type { TipoMarca } from "@prisma/client";

export type EstadoGuardia = "FUERA_DE_TURNO" | "EN_TURNO" | "EN_REFRIGERIO";

export interface MarcaResumen {
  id: string;
  tipo: TipoMarca;
  timestampServidor: Date;
}

/**
 * Inicio del "día actual" del servidor (00:00:00 local).
 * Para el demo basta con esto; en producción usaríamos la zona horaria
 * configurada de la empresa y el inicio del turno como ancla.
 */
export function inicioDelDia(ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function finDelDia(ref: Date = new Date()): Date {
  const d = new Date(ref);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Deriva el estado del guardia a partir de la última marca del día.
 */
export function estadoDesdeUltimaMarca(
  ultima: MarcaResumen | null,
): EstadoGuardia {
  if (!ultima) return "FUERA_DE_TURNO";
  switch (ultima.tipo) {
    case "ENTRADA":
    case "ENTRADA_REFRIGERIO":
      return "EN_TURNO";
    case "SALIDA_REFRIGERIO":
      return "EN_REFRIGERIO";
    case "SALIDA":
      return "FUERA_DE_TURNO";
    default:
      return "FUERA_DE_TURNO";
  }
}

/**
 * Verifica si una transición de estado es legal dado el siguiente tipo de marca.
 * Devuelve mensaje de error si NO es legal; null si es válida.
 */
export function validarTransicion(
  estadoActual: EstadoGuardia,
  siguienteTipo: TipoMarca,
): string | null {
  switch (siguienteTipo) {
    case "ENTRADA":
      if (estadoActual === "EN_TURNO")
        return "Ya tienes un turno abierto. Cierra el actual antes de iniciar otro.";
      if (estadoActual === "EN_REFRIGERIO")
        return "Estás en refrigerio. Primero registra el regreso del refrigerio.";
      return null;

    case "SALIDA":
      if (estadoActual === "FUERA_DE_TURNO")
        return "No tienes un turno abierto para cerrar.";
      // EN_TURNO o EN_REFRIGERIO → ambas permiten cerrar el turno.
      return null;

    case "SALIDA_REFRIGERIO":
      if (estadoActual !== "EN_TURNO")
        return "Solo puedes salir a refrigerio durante un turno activo.";
      return null;

    case "ENTRADA_REFRIGERIO":
      if (estadoActual !== "EN_REFRIGERIO")
        return "No tienes un refrigerio abierto para cerrar.";
      return null;

    default:
      return "Tipo de marca desconocido.";
  }
}

/**
 * Obtiene el estado actual de un guardia consultando su última marca del día.
 * Devuelve también la última marca para que el caller pueda mostrar "desde HH:MM".
 */
export async function obtenerEstadoGuardia(userId: string): Promise<{
  estado: EstadoGuardia;
  ultimaMarca: MarcaResumen | null;
}> {
  const ultimaMarca = await prisma.marca.findFirst({
    where: {
      userId,
      timestampServidor: {
        gte: inicioDelDia(),
        lte: finDelDia(),
      },
    },
    orderBy: { timestampServidor: "desc" },
    select: { id: true, tipo: true, timestampServidor: true },
  });
  return {
    estado: estadoDesdeUltimaMarca(ultimaMarca),
    ultimaMarca,
  };
}
