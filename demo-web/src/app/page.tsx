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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Control Security</h1>
          <p className="mt-1 text-sm text-gray-600">Control de asistencia para guardias</p>
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
        <div className="mt-6 rounded-2xl bg-white/60 p-4 ring-1 ring-gray-200 backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Demo · Usuarios de prueba
          </p>
          <div className="space-y-1">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => quickFill(u.email)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
              >
                <span className="font-medium">{u.label}</span>
                <span className="ml-2 text-xs text-gray-500">{u.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Contraseña para todos: <code className="rounded bg-gray-200 px-1">demo1234</code>
          </p>
        </div>
      </div>
    </main>
  );
}
