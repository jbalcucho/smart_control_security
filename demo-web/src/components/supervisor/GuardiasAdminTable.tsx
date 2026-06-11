"use client";

/**
 * GuardiasAdminTable — tabla interactiva del panel /guardias.
 *
 * Recibe la lista inicial server-side y permite:
 *   - Crear nuevo guardia (modal con GuardiaForm).
 *   - Editar un guardia existente (modal).
 *   - Borrar el historial transaccional del guardia (marcas + novedades).
 *   - Borrar el guardia (con cascade de sus marcas/novedades).
 *   - Ver el reporte del guardia.
 *
 * Las acciones llaman a los endpoints /api/guardias[/id] y /api/guardias/[id]/historial.
 * Después de cada acción exitosa hace `router.refresh()` para recargar
 * los datos server-side de la página.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/shared/Modal";
import { formatHourMinute } from "@/lib/reporte-jornada";
import { cn } from "@/lib/utils";

import { GuardiaForm, type GuardiaFormValues, type PuestoOption } from "./GuardiaForm";

export interface GuardiaRow {
  id: string;
  nombre: string;
  email: string;
  rol: "GUARDIA" | "SUPERVISOR" | "ADMIN";
  activo: boolean;
  puesto: { id: string; nombre: string } | null;
  turnoNombre: string | null;
  turnoInicio: string | null;
  turnoFin: string | null;
  estado: "EN_TURNO" | "EN_REFRIGERIO" | "FUERA_DE_TURNO";
  desdeIso: string | null;
}

interface Props {
  initialRows: GuardiaRow[];
  puestos: PuestoOption[];
  sessionUserId: string;
}

type ModalState =
  | { kind: "closed" }
  | { kind: "crear" }
  | { kind: "editar"; guardia: GuardiaRow }
  | { kind: "borrar"; guardia: GuardiaRow }
  | { kind: "borrarHistorial"; guardia: GuardiaRow };

export function GuardiasAdminTable({
  initialRows,
  puestos,
  sessionUserId,
}: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const close = () => setModal({ kind: "closed" });

  const showFlash = (kind: "ok" | "err", text: string) => {
    setFlash({ kind, text });
    setTimeout(() => setFlash(null), 4000);
  };

  // ----------------------------------------------------------
  // Acciones
  // ----------------------------------------------------------
  const crear = async (v: GuardiaFormValues) => {
    const res = await fetch("/api/guardias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: v.nombre,
        email: v.email,
        password: v.password,
        rol: v.rol,
        activo: v.activo,
        puestoId: v.puestoId || undefined,
        turnoNombre: v.turnoNombre || undefined,
        turnoInicio: v.turnoInicio || undefined,
        turnoFin: v.turnoFin || undefined,
      }),
    });
    if (!res.ok) {
      const body = await safeJson(res);
      throw new Error(body?.error ?? `Error ${res.status}`);
    }
    close();
    showFlash("ok", `Guardia "${v.nombre}" creado`);
    router.refresh();
  };

  const editar = async (v: GuardiaFormValues) => {
    if (!modal.kind || modal.kind !== "editar") return;
    const id = modal.guardia.id;
    const payload: Record<string, unknown> = {
      nombre: v.nombre,
      email: v.email,
      rol: v.rol,
      activo: v.activo,
      puestoId: v.puestoId || null,
      turnoNombre: v.turnoNombre || null,
      turnoInicio: v.turnoInicio || null,
      turnoFin: v.turnoFin || null,
    };
    if (v.password) payload.password = v.password;

    const res = await fetch(`/api/guardias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await safeJson(res);
      throw new Error(body?.error ?? `Error ${res.status}`);
    }
    close();
    showFlash("ok", `Guardia "${v.nombre}" actualizado`);
    router.refresh();
  };

  const borrar = async (g: GuardiaRow) => {
    setBusyId(g.id);
    try {
      const res = await fetch(`/api/guardias/${g.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      close();
      showFlash("ok", `Guardia "${g.nombre}" eliminado`);
      router.refresh();
    } catch (e) {
      showFlash("err", e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusyId(null);
    }
  };

  const borrarHistorial = async (g: GuardiaRow) => {
    setBusyId(g.id);
    try {
      const res = await fetch(`/api/guardias/${g.id}/historial`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      const body = await safeJson(res);
      close();
      showFlash(
        "ok",
        `Historial de "${g.nombre}" borrado (${body?.marcasEliminadas ?? 0} marcas, ${body?.novedadesEliminadas ?? 0} novedades)`,
      );
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
          {initialRows.length === 1 ? "usuario registrado" : "usuarios registrados"}
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
          Nuevo guardia
        </button>
      </div>

      <section className="card overflow-x-auto">
        {initialRows.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">No hay usuarios registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Usuario</th>
                <th className="pb-2">Rol</th>
                <th className="pb-2">Puesto</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Desde</th>
                <th className="pb-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialRows.map((r) => (
                <tr key={r.id} className={cn("text-gray-700", !r.activo && "opacity-60")}>
                  <td className="py-3">
                    <p className="font-medium text-gray-900">
                      {r.nombre}
                      {!r.activo && (
                        <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                          Inactivo
                        </span>
                      )}
                      {r.id === sessionUserId && (
                        <span className="ml-2 rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-700">
                          Tú
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{r.email}</p>
                    {r.turnoNombre && (
                      <p className="text-[11px] text-gray-500">
                        Turno: {r.turnoNombre}
                        {r.turnoInicio && r.turnoFin && (
                          <span className="ml-1 tabular-nums">
                            ({r.turnoInicio}–{r.turnoFin})
                          </span>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="py-3">
                    <RolBadge rol={r.rol} />
                  </td>
                  <td className="py-3">{r.puesto?.nombre ?? "—"}</td>
                  <td className="py-3">
                    {r.rol === "GUARDIA" ? <EstadoBadge estado={r.estado} /> : "—"}
                  </td>
                  <td className="py-3 text-xs tabular-nums text-gray-600">
                    {r.desdeIso ? formatHourMinute(new Date(r.desdeIso)) : "—"}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {r.rol === "GUARDIA" && (
                        <Link
                          href={`/guardias/${r.id}/reporte`}
                          className="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 ring-1 ring-primary-200 hover:bg-primary-100"
                        >
                          Reporte
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setModal({ kind: "editar", guardia: r })}
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => setModal({ kind: "borrarHistorial", guardia: r })}
                        className="rounded-md bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 ring-1 ring-warning-200 hover:bg-warning-100"
                        title="Borra marcas y novedades de este guardia (no borra al usuario)"
                      >
                        Borrar historial
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id || r.id === sessionUserId}
                        onClick={() => setModal({ kind: "borrar", guardia: r })}
                        className="rounded-md bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger-700 ring-1 ring-danger-200 hover:bg-danger-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          r.id === sessionUserId
                            ? "No puedes eliminar tu propia cuenta"
                            : "Borrar guardia y todo su historial"
                        }
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
        title="Nuevo guardia"
        description="Crea una nueva cuenta de usuario (guardia, supervisor o admin)."
        size="lg"
      >
        <GuardiaForm mode="crear" puestos={puestos} onSubmit={crear} onCancel={close} />
      </Modal>

      {/* Modal editar */}
      <Modal
        open={modal.kind === "editar"}
        onClose={close}
        title={
          modal.kind === "editar" ? `Editar: ${modal.guardia.nombre}` : "Editar"
        }
        description="Actualiza los datos del usuario. La contraseña solo cambia si la escribes."
        size="lg"
      >
        {modal.kind === "editar" && (
          <GuardiaForm
            mode="editar"
            puestos={puestos}
            initial={{
              nombre: modal.guardia.nombre,
              email: modal.guardia.email,
              rol: modal.guardia.rol,
              puestoId: modal.guardia.puesto?.id ?? "",
              turnoNombre: modal.guardia.turnoNombre ?? "",
              turnoInicio: modal.guardia.turnoInicio ?? "",
              turnoFin: modal.guardia.turnoFin ?? "",
              activo: modal.guardia.activo,
            }}
            onSubmit={editar}
            onCancel={close}
          />
        )}
      </Modal>

      {/* Modal borrar (confirmación) */}
      <Modal
        open={modal.kind === "borrar"}
        onClose={close}
        title="Eliminar guardia"
        size="sm"
      >
        {modal.kind === "borrar" && (
          <ConfirmDelete
            mensaje={
              <>
                Vas a eliminar a <strong>{modal.guardia.nombre}</strong> y{" "}
                <em>todo</em> su historial (marcas, novedades, alertas). Esta acción
                no se puede deshacer.
              </>
            }
            confirmLabel="Eliminar guardia"
            danger
            onCancel={close}
            onConfirm={() => borrar(modal.guardia)}
            busy={busyId === modal.guardia.id}
          />
        )}
      </Modal>

      {/* Modal borrar historial (confirmación) */}
      <Modal
        open={modal.kind === "borrarHistorial"}
        onClose={close}
        title="Borrar historial del guardia"
        size="sm"
      >
        {modal.kind === "borrarHistorial" && (
          <ConfirmDelete
            mensaje={
              <>
                Vas a eliminar TODAS las marcas y novedades de{" "}
                <strong>{modal.guardia.nombre}</strong>. El usuario se mantiene
                activo, pero arranca de cero. Pensado para preparar la cuenta
                antes de una demo.
              </>
            }
            confirmLabel="Borrar historial"
            danger={false}
            onCancel={close}
            onConfirm={() => borrarHistorial(modal.guardia)}
            busy={busyId === modal.guardia.id}
          />
        )}
      </Modal>
    </>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function RolBadge({ rol }: { rol: GuardiaRow["rol"] }) {
  const palette = {
    GUARDIA: "bg-gray-100 text-gray-700",
    SUPERVISOR: "bg-primary-100 text-primary-700",
    ADMIN: "bg-accent-100 text-accent-700",
  } as const;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", palette[rol])}>
      {rol}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: GuardiaRow["estado"] }) {
  if (estado === "EN_TURNO") {
    return (
      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
        En turno
      </span>
    );
  }
  if (estado === "EN_REFRIGERIO") {
    return (
      <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
        🍽️ Refrigerio
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      Fuera
    </span>
  );
}

function ConfirmDelete({
  mensaje,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
  busy,
}: {
  mensaje: React.ReactNode;
  confirmLabel: string;
  danger: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">{mensaje}</p>
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
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold text-white",
            danger
              ? busy
                ? "bg-danger-400"
                : "bg-danger-600 hover:bg-danger-700"
              : busy
                ? "bg-warning-400"
                : "bg-warning-600 hover:bg-warning-700",
          )}
        >
          {busy ? "Procesando…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// utils
// ----------------------------------------------------------
async function safeJson(res: Response): Promise<{ error?: string } & Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
