/**
 * Utilidades para validación de geofence.
 *
 * En el demo usamos la fórmula de Haversine en JavaScript.
 * En producción esto se hará server-side con PostGIS (ver docs/modelo-datos.md).
 */

const EARTH_RADIUS_M = 6_371_000;

/**
 * Calcula la distancia en metros entre dos coordenadas (lat/lng)
 * usando la fórmula de Haversine.
 *
 * Precisión: ~0.5% (suficiente para geofence de 100m+).
 */
export function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

export interface GeofenceValidation {
  dentroDelGeofence: boolean;
  distanciaM: number;
  motivoFraude: string | null;
}

/**
 * Valida si una coordenada está dentro del geofence de un puesto.
 *
 * @returns Objeto con el resultado + razón si hay fraude.
 */
export function validateGeofence(
  userLat: number,
  userLng: number,
  puestoLat: number,
  puestoLng: number,
  radioMaxM: number,
): GeofenceValidation {
  const distanciaM = distanceInMeters(userLat, userLng, puestoLat, puestoLng);
  const dentro = distanciaM <= radioMaxM;

  return {
    dentroDelGeofence: dentro,
    distanciaM: Math.round(distanciaM * 10) / 10, // 1 decimal
    motivoFraude: dentro
      ? null
      : `Marca registrada a ${Math.round(distanciaM)}m del puesto asignado (límite: ${radioMaxM}m)`,
  };
}

/**
 * Valida la precisión del GPS reportada por el navegador.
 * Si es peor que el umbral configurado, rechazamos la marca.
 */
export function isGPSAcceptable(
  precisionM: number,
  maxPrecisionM: number = 50,
): { acceptable: boolean; reason: string | null } {
  if (precisionM > maxPrecisionM) {
    return {
      acceptable: false,
      reason: `GPS impreciso (precisión: ±${Math.round(precisionM)}m, mínimo aceptable: ±${maxPrecisionM}m)`,
    };
  }
  return { acceptable: true, reason: null };
}
