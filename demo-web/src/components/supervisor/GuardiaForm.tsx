"use client";

/**
 * GuardiaForm — formulario reutilizable para crear o editar un guardia.
 *
 * Se usa dentro de los modales de la pantalla `/guardias` (admin).
 * En modo "crear", `password` es obligatorio. En modo "editar" es opcional
 * (si se llena, se actualiza; si se deja vacío, no se toca).
 */

import { useState } from "react";

import { cn } from "@/lib/utils";

export interface GuardiaFormValues {
  id?: string;
  nombre: string;
  email: string;
  password: string;
  rol: "GUARDIA" | "SUPERVISOR" | "ADMIN";
  puestoId: string | "";
  turnoNombre: string;
  turnoInicio: string;
  turnoFin: string;
  activo: boolean;
}

export interface PuestoOption {
  id: string;
  nombre: string;
}

interface Props {
  mode: "crear" | "editar";
  initial?: Partial<GuardiaFormValues>;
  puestos: PuestoOption[];
  /** Devuelve un objeto que el caller manda al endpoint. Si lanza, se muestra el mensaje. */
  onSubmit: (values: GuardiaFormValues) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: GuardiaFormValues = {
  nombre: "",
  email: "",
  password: "",
  rol: "GUARDIA",
  puestoId: "",
  turnoNombre: "",
  turnoInicio: "",
  turnoFin: "",
  activo: true,
};

export function GuardiaForm({ mode, initial, puestos, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<GuardiaFormValues>({
    ...EMPTY,
    ...(initial ?? {}),
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof GuardiaFormValues>(
    key: K,
    value: GuardiaFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "crear" && values.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (values.nombre.trim().length < 2) {
      setError("Nombre demasiado corto");
      return;
    }
    if (!values.email.includes("@")) {
      setError("Email inválido");
      return;
    }
    if (!!values.turnoInicio !== !!values.turnoFin) {
      setError("Si pones horario debes incluir inicio y fin");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre completo" required>
          <input
            type="text"
            required
            value={values.nombre}
            onChange={(e) => updateField("nombre", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            required
            autoComplete="off"
            value={values.email}
            onChange={(e) => updateField("email", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={mode === "crear" ? "Contraseña" : "Resetear contraseña (opcional)"}
          required={mode === "crear"}
          hint={mode === "editar" ? "Déjalo en blanco para mantener la actual" : undefined}
        >
          <input
            type="password"
            required={mode === "crear"}
            autoComplete="new-password"
            placeholder={mode === "editar" ? "(sin cambios)" : "Mínimo 6 caracteres"}
            value={values.password}
            onChange={(e) => updateField("password", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Rol">
          <select
            value={values.rol}
            onChange={(e) =>
              updateField("rol", e.target.value as GuardiaFormValues["rol"])
            }
            className={inputCls}
          >
            <option value="GUARDIA">Guardia</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </Field>
      </div>

      <Field label="Puesto asignado">
        <select
          value={values.puestoId}
          onChange={(e) => updateField("puestoId", e.target.value)}
          className={inputCls}
        >
          <option value="">— Sin puesto —</option>
          {puestos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="rounded-lg border border-gray-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-gray-600">
          Turno (opcional)
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nombre">
            <input
              type="text"
              placeholder="Mañana 6-14"
              value={values.turnoNombre}
              onChange={(e) => updateField("turnoNombre", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Inicio">
            <input
              type="time"
              value={values.turnoInicio}
              onChange={(e) => updateField("turnoInicio", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Fin">
            <input
              type="time"
              value={values.turnoFin}
              onChange={(e) => updateField("turnoFin", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </fieldset>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.activo}
          onChange={(e) => updateField("activo", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Cuenta activa (puede iniciar sesión)
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
              ? "Crear guardia"
              : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Helpers de input
// ============================================================

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
