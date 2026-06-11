"use client";

/**
 * Página de Login (raíz).
 *
 * Si el usuario ya está autenticado, el middleware lo redirige a:
 *   - GUARDIA → /home
 *   - SUPERVISOR/ADMIN → /dashboard
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";

const DEMO_USERS = [
  { email: "guardia1@demo.com", label: "Guardia 1 (Sede Norte)" },
  { email: "guardia2@demo.com", label: "Guardia 2 (Sede Sur)" },
  { email: "supervisor@demo.com", label: "Supervisor" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email o contraseña incorrectos");
        setLoading(false);
        return;
      }

      // El middleware se encarga de redirigir según el rol.
      // Forzamos refresh para que la sesión se cargue.
      router.refresh();
      // El callback authorized de auth.ts redirige automáticamente.
      // Si llega aquí, redirigimos manualmente al home por defecto.
      window.location.href = "/home";
    } catch (err) {
      console.error(err);
      setError("Error inesperado. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const quickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo1234");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-dark-950 via-brand-dark-900 to-brand-dark-800 p-4">
      {/* Patrón sutil en el fondo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #facc15 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        {/* Logo / Brand — el logo va dentro de un disco blanco para
            destacar sobre el fondo oscuro (el JPEG trae su propio borde negro). */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-5 inline-flex">
            {/* Halo dorado decorativo */}
            <div
              className="absolute inset-0 -m-2 rounded-full bg-accent-400/30 blur-xl"
              aria-hidden
            />
            {/* Placa blanca con ring dorado */}
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-white p-3 shadow-2xl ring-4 ring-accent-400/80">
              <Logo size="xl" priority className="rounded-full" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Scorpions D.L.</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.3em] text-accent-400">
            Private Security
          </p>
          <p className="mt-3 text-sm text-gray-300">
            Sistema de control de asistencia
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-100"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border-gray-300 px-3 py-3 shadow-sm ring-1 ring-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              placeholder="tu@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border-gray-300 px-3 py-3 shadow-sm ring-1 ring-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn("btn-primary w-full text-base", loading && "opacity-70")}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* Quick-fill para el demo */}
        <div className="mt-6 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-400">
            Demo · Usuarios de prueba
          </p>
          <div className="space-y-1">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => quickFill(u.email)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="font-medium">{u.label}</span>
                <span className="ml-2 text-xs text-gray-400">{u.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Contraseña para todos:{" "}
            <code className="rounded bg-white/15 px-1.5 py-0.5 text-accent-400">
              demo1234
            </code>
          </p>
        </div>
      </div>
    </main>
  );
}
