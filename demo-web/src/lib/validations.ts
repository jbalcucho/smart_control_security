/**
 * Schemas de validación con Zod compartidos entre cliente y servidor.
 */

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Validación del payload para crear una marca.
 * Lo envía el guardia desde el browser.
 *
 * `fotoBase64` es una data URL del tipo "data:image/jpeg;base64,...."
 * generada por canvas.toDataURL() en el cliente.
 */
export const crearMarcaSchema = z.object({
  tipo: z.enum(["ENTRADA", "SALIDA"]),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  precisionM: z.number().positive(),
  timestampCliente: z.string().datetime(),
  fotoBase64: z
    .string()
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
      message: "fotoBase64 debe ser una data URL de imagen válida",
    })
    // Límite ~1.5 MB en base64 (~1 MB binario): suficiente para selfies
    // comprimidas a 640x480 con calidad 0.7 (~50-80 KB típico).
    .max(1_500_000, "La foto es demasiado grande (máx 1.5 MB)"),
});

export type CrearMarcaInput = z.infer<typeof crearMarcaSchema>;

/**
 * Validación del payload para crear una novedad.
 * Lo envía el guardia desde el browser (formulario o botón de pánico).
 *
 * GPS es opcional porque el guardia puede negar el permiso, o en el caso
 * del pánico queremos enviar igual aunque el GPS aún no esté disponible.
 */
export const crearNovedadSchema = z
  .object({
    tipo: z.enum(["GENERAL", "REFUERZO", "PANICO", "INFORMATIVA"]),
    descripcion: z
      .string()
      .trim()
      .max(2000, "La descripción es demasiado larga (máx 2000 caracteres)")
      .optional()
      .default(""),
    refuerzosNecesarios: z.boolean().optional().default(false),
    latitud: z.number().min(-90).max(90).optional(),
    longitud: z.number().min(-180).max(180).optional(),
    precisionM: z.number().positive().optional(),
    timestampCliente: z.string().datetime(),
  })
  .refine(
    (data) => {
      // Para novedades NO-PANICO, la descripción es obligatoria (mín 5 chars).
      if (data.tipo === "PANICO") return true;
      return data.descripcion !== undefined && data.descripcion.trim().length >= 5;
    },
    {
      message: "La descripción es obligatoria y debe tener al menos 5 caracteres",
      path: ["descripcion"],
    },
  )
  .refine(
    (data) => {
      // Si viene una coordenada, deben venir las dos.
      const hasLat = data.latitud !== undefined;
      const hasLng = data.longitud !== undefined;
      return hasLat === hasLng;
    },
    {
      message: "Si envías GPS debes incluir latitud y longitud",
      path: ["latitud"],
    },
  );

export type CrearNovedadInput = z.infer<typeof crearNovedadSchema>;

/**
 * Validación del payload para resolver una novedad (supervisor).
 */
export const resolverNovedadSchema = z.object({
  estado: z.enum(["EN_ATENCION", "RESUELTA", "DESCARTADA"]),
  notasSupervisor: z
    .string()
    .trim()
    .max(2000, "Las notas son demasiado largas (máx 2000 caracteres)")
    .optional(),
});

export type ResolverNovedadInput = z.infer<typeof resolverNovedadSchema>;
