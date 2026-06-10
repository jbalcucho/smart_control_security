/**
 * Pantalla de marcaje (Server Component).
 *
 * Server-side:
 *   - Verifica sesión (ya viene del layout, pero hacemos doble check)
 *   - Carga el puesto asignado al guardia desde la BD
 *   - Pasa esos datos al MarcaWizard (Client Component) que orquesta el flujo
 */

import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarcaWizard } from "@/components/guardia/MarcaWizard";

export default async function MarcarPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { puesto: true },
  });

  // Sin puesto asignado → no puede marcar
  if (!user?.puesto) {
    return (
      <div className="space-y-4 animate-fade-in">
        <header className="card">
          <h1 className="text-xl font-bold text-gray-900">Marcar asistencia</h1>
        </header>
        <section className="card bg-warning-50 ring-warning-500/30">
          <p className="text-sm font-semibold text-warning-700">
            No tienes un puesto asignado
          </p>
          <p className="mt-1 text-sm text-warning-700">
            Contacta a tu supervisor para que te asigne un puesto antes de marcar.
          </p>
          <Link href="/home" className="mt-3 inline-block btn-secondary text-sm">
            Volver al inicio
          </Link>
        </section>
      </div>
    );
  }

  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const maxGpsPrecisionM = Number(process.env.NEXT_PUBLIC_GPS_PRECISION_MIN_M ?? 50);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link
          href="/home"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200"
          aria-label="Volver al inicio"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Marcar asistencia</h1>
          <p className="text-xs text-gray-500">Sigue los 3 pasos del wizard</p>
        </div>
      </header>

      <MarcaWizard
        puesto={{
          id: user.puesto.id,
          nombre: user.puesto.nombre,
          direccion: user.puesto.direccion,
          latitud: user.puesto.latitud,
          longitud: user.puesto.longitud,
          radioGeofenceM: user.puesto.radioGeofenceM,
        }}
        demoMode={demoMode}
        maxGpsPrecisionM={maxGpsPrecisionM}
      />
    </div>
  );
}
