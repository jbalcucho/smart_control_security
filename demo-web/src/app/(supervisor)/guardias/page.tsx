/**
 * Administración de guardias (vista del supervisor).
 *
 * Server Component que precarga la lista completa de usuarios + los puestos
 * disponibles, y delega la UI interactiva (crear, editar, borrar, borrar
 * historial) a <GuardiasAdminTable />.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estadoDesdeUltimaMarca, type EstadoGuardia } from "@/lib/estado-guardia";
import {
  GuardiasAdminTable,
  type GuardiaRow,
} from "@/components/supervisor/GuardiasAdminTable";

export default async function GuardiasPage() {
  const session = await auth();
  if (!session?.user) return null;

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [usuarios, puestos] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        turnoNombre: true,
        turnoInicio: true,
        turnoFin: true,
        puesto: { select: { id: true, nombre: true } },
        marcas: {
          where: { timestampServidor: { gte: inicioHoy } },
          orderBy: { timestampServidor: "desc" },
          take: 1,
          select: { id: true, tipo: true, timestampServidor: true },
        },
      },
    }),
    prisma.puesto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const rows: GuardiaRow[] = usuarios.map((u) => {
    const ultima = u.marcas[0] ?? null;
    const estado: EstadoGuardia = estadoDesdeUltimaMarca(ultima);
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      puesto: u.puesto,
      turnoNombre: u.turnoNombre,
      turnoInicio: u.turnoInicio,
      turnoFin: u.turnoFin,
      estado,
      desdeIso: ultima?.timestampServidor.toISOString() ?? null,
    };
  });

  const guardiaRows = rows.filter((r) => r.rol === "GUARDIA");
  const contadores = guardiaRows.reduce(
    (acc, r) => {
      acc[r.estado] += 1;
      return acc;
    },
    { EN_TURNO: 0, EN_REFRIGERIO: 0, FUERA_DE_TURNO: 0 } as Record<
      EstadoGuardia,
      number
    >,
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Administrar guardias</h1>
        <p className="mt-1 text-sm text-gray-600">
          Crea, edita, asigna a un puesto y consulta el reporte de cada guardia.
          También puedes borrar el historial transaccional para preparar la
          cuenta antes de una demo.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <KpiPill label="En turno" value={contadores.EN_TURNO} tone="primary" />
        <KpiPill
          label="🍽️ En refrigerio"
          value={contadores.EN_REFRIGERIO}
          tone="accent"
        />
        <KpiPill label="Fuera" value={contadores.FUERA_DE_TURNO} tone="muted" />
      </section>

      <GuardiasAdminTable
        initialRows={rows}
        puestos={puestos}
        sessionUserId={session.user.id}
      />
    </div>
  );
}

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "accent" | "muted";
}) {
  const palette = {
    primary: "bg-primary-50 text-primary-700",
    accent: "bg-accent-50 text-accent-700",
    muted: "bg-gray-100 text-gray-600",
  } as const;
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${palette[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
