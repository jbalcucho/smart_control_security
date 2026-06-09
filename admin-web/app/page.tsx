import { Shield } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-12 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-brand-100 p-5">
            <Shield className="h-12 w-12 text-brand-600" strokeWidth={1.5} />
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            Smart Control Security
          </h1>
          <p className="mt-2 text-lg text-slate-600">Panel administrativo</p>

          <div className="mt-10 w-full rounded-xl border border-amber-200 bg-amber-50 p-6 text-left">
            <h2 className="text-base font-semibold text-amber-900">
              🏗️ Scaffold inicial
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              Este panel web se construye en la <strong>Fase 5</strong> del roadmap. Por ahora solo
              existe la estructura base para que cualquier desarrollador frontend pueda comenzar
              cuando llegue el momento.
            </p>
            <p className="mt-3 text-sm text-amber-800">
              Consultar <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
                docs/funcionalidades-admin-web.md
              </code>{" "}
              y{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
                docs/roadmap-fases.md
              </code>{" "}
              para más detalles.
            </p>
          </div>

          <div className="mt-8 grid w-full grid-cols-2 gap-4 text-left">
            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Stack</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>• Next.js 15 + App Router</li>
                <li>• React 19</li>
                <li>• TypeScript estricto</li>
                <li>• Tailwind CSS 3</li>
              </ul>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Data layer</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>• TanStack Query</li>
                <li>• Zod (validación)</li>
                <li>• React Hook Form</li>
                <li>• Recharts (gráficos)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
