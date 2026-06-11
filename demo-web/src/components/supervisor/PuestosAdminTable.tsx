"use client";

/**
 * PuestosAdminTable — tabla interactiva del panel /puestos.
 *
 * Acciones:
 *  - Crear puesto (modal con PuestoForm).
 *  - Editar puesto (modal).
 *  - Eliminar puesto. Si tiene marcas históricas el endpoint devuelve 409;
 *    en ese caso ofrecemos al supervisor un segundo botón "Eliminar con
 *    historial (force=true)" en el mismo modal.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/utils";

import { PuestoForm, type PuestoFormValues } from "./PuestoForm";

export interface PuestoRow {
  id: string;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  radioGeofenceM: number;
  activo: boolean;
  guardiasCount: number;
  marcasCount: number;
}

interface Props {
  initialRows: PuestoRow[];
}

type ModalState =
  | { kind: "closed" }
  | { kind: "crear" }
  | { kind: "editar"; puesto: PuestoRow }
  | { kind: "borrar"; puesto: PuestoRow; requiereForce: boolean };

export function PuestosAdminTable({ initialRows }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const close = () => setModal({ kind: "closed" });

  const showFlash = (kind: "ok" | "err", text: string) => {
    setFlash({ kind, text });
    setTimeout(() => setFlash(null), 4000);
  };

  // ----------------------------------------------------------
  // Acciones
  // ----------------------------------------------------------
  const crear = async (v: PuestoFormValues) => {
    const res = await fetch("/api/puestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: v.nombre,
        direccion: v.direccion,
        latitud: v.latitud,
        longitud: v.longitud,
        radioGeofenceM: v.radioGeofenceM,
        activo: v.activo,
      }),
    });
    if (!res.ok) {
      const body = await safeJson(res);
      throw new Error(body?.error ?? `Error ${res.status}`);
    }
    close();
    showFlash("ok", `Puesto "${v.nombre}" creado`);
    router.refresh();
  };

  const editar = async (v: PuestoFormValues) => {
    if (modal.kind !== "editar") return;
    const id = modal.puesto.id;
    const res = await fetch(`/api/puestos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: v.nombre,
        direccion: v.direccion,
        latitud: v.latitud,
        longitud: v.longitud,
        radioGeofenceM: v.radioGeofenceM,
        activo: v.activo,
      }),
    });
    if (!res.ok) {
      const body = await safeJson(res);
      throw new Error(body?.error ?? `Error ${res.status}`);
    }
    close();
    showFlash("ok", `Puesto "${v.nombre}" actualizado`);
    router.refresh();
  };

  const borrar = async (p: PuestoRow, force: boolean) => {
    setBusyId(p.id);
    try {
      const qs = force ? "?force=true" : "";
      const res = await fetch(`/api/puestos/${p.id}${qs}`, { method: "DELETE" });
      if (res.status === 409 && !force) {
        // Reabrir el modal en modo "requiere force".
        const body = await safeJson(res);
        setModal({ kind: "borrar", puesto: p, requiereForce: true });
        showFlash(
          "err",
          body?.error ??
            `Tiene historial: ${(body?.marcasHistoricas as number) ?? 0} marcas. Usa "Eliminar con historial" para forzar.`,
        );
        return;
      }
      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      close();
      showFlash("ok", `Puesto "${p.nombre}" eliminado`);
      router.refresh();
    } catch (e) {
      showFlash("err", e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <>
      {flash && (
        <div
          className={cn(
            "rounded-md px-3 py-2 text-sm ring-1",
            flash.kind === "ok"
              ? "bg-success-50 text-success-700 ring-success-200"
              : "bg-danger-50 text-danger-700 ring-danger-200",
          )}
        >
          {flash.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          {initialRows.length}{" "}
          {initialRows.length === 1 ? "puesto registrado" : "puestos registrados"}
        </h2>
        <button
          type="button"
          onClick={() => setModal({ kind: "crear" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo puesto
        </button>
      </div>

      <section className="card overflow-x-auto">
        {initialRows.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">
            No hay puestos registrados. Crea uno para empezar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Puesto</th>
                <th className="pb-2">Ubicación</th>
                <th className="pb-2 text-center">Radio</th>
                <th className="pb-2 text-center">Guardias</th>
                <th className="pb-2 text-center">Marcas</th>
                <th className="pb-2 text-center">Estado</th>
                <th className="pb-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialRows.map((p) => (
                <tr
                  key={p.id}
                  className={cn("text-gray-700", !p.activo && "opacity-60")}
                >
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{p.direccion}</p>
                  </td>
                  <td className="py-3 text-xs tabular-nums">
                    <p>
                      {p.latitud.toFixed(5)}, {p.longitud.toFixed(5)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${p.latitud},${p.longitud}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-primary-700 hover:underline"
                    >
                      Abrir en Maps →
                    </a>
                  </td>
                  <td className="py-3 text-center text-xs tabular-nums">
                    {p.radioGeofenceM} m
                  </td>
                  <td className="py-3 text-center text-xs tabular-nums">
                    {p.guardiasCount}
                  </td>
                  <td className="py-3 text-center text-xs tabular-nums">
                    {p.marcasCount}
                  </td>
                  <td className="py-3 text-center">
                    {p.activo ? (
                      <span className="rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-bold uppercase text-success-700">
                        Activo
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ kind: "editar", puesto: p })}
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() =>
                          setModal({
                            kind: "borrar",
                            puesto: p,
                            requiereForce: p.marcasCount > 0,
                          })
                        }
                        className="rounded-md bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger-700 ring-1 ring-danger-200 hover:bg-danger-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Modal crear */}
      <Modal
        open={modal.kind === "crear"}
        onClose={close}
        title="Nuevo puesto"
        description="Define la ubicación, dirección y radio del geofence."
        size="md"
      >
        <PuestoForm mode="crear" onSubmit={crear} onCancel={close} />
      </Modal>

      {/* Modal editar */}
      <Modal
        open={modal.kind === "editar"}
        onClose={close}
        title={modal.kind === "editar" ? `Editar: ${modal.puesto.nombre}` : "Editar"}
        size="md"
      >
        {modal.kind === "editar" && (
          <PuestoForm
            mode="editar"
            initial={{
              nombre: modal.puesto.nombre,
              direccion: modal.puesto.direccion,
              latitud: modal.puesto.latitud,
              longitud: modal.puesto.longitud,
              radioGeofenceM: modal.puesto.radioGeofenceM,
              activo: modal.puesto.activo,
            }}
            onSubmit={editar}
            onCancel={close}
          />
        )}
      </Modal>

      {/* Modal borrar */}
      <Modal
        open={modal.kind === "borrar"}
        onClose={close}
        title="Eliminar puesto"
        size="sm"
      >
        {modal.kind === "borrar" && (
          <ConfirmDelete
            puesto={modal.puesto}
            requiereForce={modal.requiereForce}
            busy={busyId === modal.puesto.id}
            onCancel={close}
            onConfirm={(force) => borrar(modal.puesto, force)}
          />
        )}
      </Modal>
    </>
  );
}

function ConfirmDelete({
  puesto,
  requiereForce,
  busy,
  onCancel,
  onConfirm,
}: {
  puesto: PuestoRow;
  requiereForce: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (force: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Vas a eliminar el puesto <strong>{puesto.nombre}</strong>.
      </p>
      {puesto.guardiasCount > 0 && (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-800 ring-1 ring-warning-200">
          Hay {puesto.guardiasCount}{" "}
          {puesto.guardiasCount === 1 ? "guardia asignado" : "guardias asignados"}.
          Quedarán <strong>sin puesto</strong> (no se elimina al guardia, solo se desasigna).
        </p>
      )}
      {requiereForce && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-xs text-danger-800 ring-1 ring-danger-200">
          Tiene <strong>{puesto.marcasCount} marcas históricas</strong>. El borrado
          normal está bloqueado. Si confirmas, se eliminarán todas las marcas y
          novedades asociadas a este puesto. Esta acción <em>no se puede deshacer</em>.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onConfirm(requiereForce)}
          disabled={busy}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold text-white",
            busy
              ? "bg-danger-400"
              : "bg-danger-600 hover:bg-danger-700",
          )}
        >
          {busy
            ? "Procesando…"
            : requiereForce
              ? "Eliminar con historial"
              : "Eliminar puesto"}
        </button>
      </div>
    </div>
  );
}

async function safeJson(res: Response): Promise<{ error?: string } & Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
