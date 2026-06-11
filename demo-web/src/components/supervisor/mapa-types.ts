/**
 * Tipos compartidos entre el endpoint /api/mapa-snapshot,
 * la página /mapa y los componentes del mapa.
 *
 * Coinciden con la forma serializada (fechas como ISO string).
 */

export interface PuestoMapa {
  id: string;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radioGeofenceM: number;
}

export interface MarcaMapa {
  id: string;
  tipo: "ENTRADA" | "SALIDA" | "SALIDA_REFRIGERIO" | "ENTRADA_REFRIGERIO";
  latitud: number;
  longitud: number;
  precisionM: number;
  distanciaPuestoM: number;
  dentroDelGeofence: boolean;
  esFraude: boolean;
  timestampServidor: string;
  /** null para refrigerios (no llevan selfie). */
  fotoUrl: string | null;
  user: { id: string; nombre: string };
  puesto: { id: string; nombre: string };
}

export interface NovedadMapa {
  id: string;
  tipo: "GENERAL" | "REFUERZO" | "PANICO" | "INFORMATIVA";
  severidad: "BAJA" | "MEDIA" | "ALTA";
  estado: "PENDIENTE" | "EN_ATENCION" | "RESUELTA" | "DESCARTADA";
  descripcion: string;
  refuerzosNecesarios: boolean;
  latitud: number;
  longitud: number;
  precisionM: number | null;
  timestampServidor: string;
  user: { id: string; nombre: string };
  puesto: { id: string; nombre: string } | null;
}

export interface MapaSnapshot {
  puestos: PuestoMapa[];
  marcas: MarcaMapa[];
  novedades: NovedadMapa[];
  generatedAt: string;
}
