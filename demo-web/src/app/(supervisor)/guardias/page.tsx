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
import { parseRango } from "@/lib/rango-fecha";
import { FechaSelector } from "@/components/shared/FechaSelector";
import {
  GuardiasAdminTable,
  type GuardiaRow,
} from "@/components/supervisor/GuardiasAdminTable";

export default async function GuardiasPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; desde?: string; hasta?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const sp = await searchParams;
  const rango = parseRango(sp, { defaultMode: "hoy" });

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

  // Para evitar duplicar el query string si el usuario seleccionó "todas"
  // (que no aplica al export), forzamos un fallback a hoy en ese caso.
  const exportQs = rango.queryString || `?fecha=${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administrar guardias</h1>
          <p className="mt-1 text-sm text-gray-600">
            Crea, edita, asigna a un puesto y consulta el reporte de cada guardia.
            También puedes borrar el historial transaccional para preparar la
            cuenta antes de una demo.
          </p>
        </div>
        <a
          href={`/api/reportes/consolidado${exportQs}`}
          download
          className="inline-flex items-center gap-1.5 rounded-lg bg-success-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-success-700"
          title="Descargar CSV con horas turno / refrigerios / efectivo por guardia"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            />
          </svg>
          Exportar consolidado ({rango.label})
        </a>
      </header>

      <FechaSelector basePath="/guardias" rangoActual={rango} incluirTodas={false} />

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
