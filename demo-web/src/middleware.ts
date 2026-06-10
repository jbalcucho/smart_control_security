/**
 * Middleware de Next.js — protección de rutas y redirección por rol.
 *
 * La lógica vive en el callback `authorized` de lib/auth.ts.
 * Acá solo declaramos el matcher.
 */

export { auth as middleware } from "@/lib/auth";

export const config = {
  // Matcher: todas las rutas EXCEPTO assets estáticos y endpoints públicos
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
