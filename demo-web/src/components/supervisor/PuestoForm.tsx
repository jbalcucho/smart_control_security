"use client";

/**
 * PuestoForm — formulario para crear o editar un Puesto.
 *
 * Lat/lng se editan como dos inputs numéricos. Para el demo es suficiente;
 * en producción se agregaría un picker en el mapa.
 */

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface PuestoFormValues {
  nombre: string;
  direccion: string;
  latitud: number | "";
  longitud: number | "";
  radioGeofenceM: number;
  activo: boolean;
}

interface Props {
  mode: "crear" | "editar";
  initial?: Partial<PuestoFormValues>;
  onSubmit: (values: PuestoFormValues) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: PuestoFormValues = {
  nombre: "",
  direccion: "",
  latitud: "",
  longitud: "",
  radioGeofenceM: 100,
  activo: true,
};

export function PuestoForm({ mode, initial, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<PuestoFormValues>({
    ...EMPTY,
    ...(initial ?? {}),
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof PuestoFormValues>(
    key: K,
    value: PuestoFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (values.nombre.trim().length < 2) {
      setError("Nombre demasiado corto");
      return;
    }
    if (values.direccion.trim().length < 2) {
      setError("Dirección demasiado corta");
      return;
    }
    const lat = typeof values.latitud === "number" ? values.latitud : NaN;
    const lng = typeof values.longitud === "number" ? values.longitud : NaN;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError("Latitud inválida (-90 a 90)");
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError("Longitud inválida (-180 a 180)");
      return;
    }
    if (values.radioGeofenceM < 10 || values.radioGeofenceM > 5000) {
      setError("Radio fuera de rango (10 – 5 000 m)");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ ...values, latitud: lat, longitud: lng });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700 ring-1 ring-danger-200">
          {error}
        </div>
      )}

      <Field label="Nombre" required>
        <input
          type="text"
          required
          value={values.nombre}
          onChange={(e) => update("nombre", e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="Dirección" required>
        <input
          type="text"
          required
          value={values.direccion}
          onChange={(e) => update("direccion", e.target.value)}
          className={inputCls}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Latitud" required hint="-90 a 90">
          <input
            type="number"
            required
            step="any"
            value={values.latitud}
            onChange={(e) =>
              update(
                "latitud",
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
            className={inputCls}
          />
        </Field>
        <Field label="Longitud" required hint="-180 a 180">
          <input
            type="number"
            required
            step="any"
            value={values.longitud}
            onChange={(e) =>
              update(
                "longitud",
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
            className={inputCls}
          />
        </Field>
        <Field label="Radio (m)" required hint="Geofence">
          <input
            type="number"
            required
            min={10}
            max={5000}
            step={10}
            value={values.radioGeofenceM}
            onChange={(e) =>
              update("radioGeofenceM", Number(e.target.value) || 0)
            }
            className={inputCls}
          />
        </Field>
      </div>

      <p className="rounded-md bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600">
        Tip: puedes copiar coordenadas desde Google Maps (click derecho → la
        primera línea es <code>lat, lng</code>).
      </p>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.activo}
          onChange={(e) => update("activo", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Puesto activo (aparece en el mapa y se puede asignar guardias)
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold text-white",
            submitting
              ? "cursor-not-allowed bg-primary-400"
              : "bg-primary-600 hover:bg-primary-700",
          )}
        >
          {submitting
            ? "Guardando…"
            : mode === "crear"
              ? "Crear puesto"
              : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-danger-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-gray-500">{hint}</span>}
    </label>
  );
}
