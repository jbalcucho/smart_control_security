/**
 * Configuración de NextAuth v5 (Auth.js).
 *
 * - Provider: Credentials (email + password)
 * - Estrategia de sesión: JWT (sin tabla extra)
 * - Validación: bcrypt + Zod
 *
 * Para el demo NO usamos OAuth (Google, etc.) — solo mock con 3 usuarios
 * precargados por el seed.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
// Importar el submódulo para que TypeScript permita augmentar `JWT`
import "next-auth/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// ------------------------------------------------------------
// Augmentación de tipos para incluir rol y puestoId en la sesión
// ------------------------------------------------------------

declare module "next-auth" {
  interface User {
    rol: Role;
    puestoId: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      nombre: string;
      rol: Role;
      puestoId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol: Role;
    puestoId: string | null;
  }
}

// ------------------------------------------------------------
// Schema de validación
// ------------------------------------------------------------

const credentialsSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// ------------------------------------------------------------
// Config principal
// ------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/",
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24h
  },

  providers: [
    Credentials({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },

      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.activo) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        // Actualizar último login (best-effort, no bloquea)
        prisma.user
          .update({
            where: { id: user.id },
            data: { ultimoLogin: new Date() },
          })
          .catch(() => {
            /* ignore */
          });

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          nombre: user.nombre,
          rol: user.rol,
          puestoId: user.puestoId,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
        token.puestoId = user.puestoId;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol;
        session.user.puestoId = token.puestoId;
      }
      return session;
    },

    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user;
      const isOnLogin = nextUrl.pathname === "/";
      const isOnApi = nextUrl.pathname.startsWith("/api/auth");

      if (isOnApi) return true;
      if (isOnLogin) {
        if (isLoggedIn) {
          // Redirigir según rol
          const url =
            session.user.rol === "SUPERVISOR" || session.user.rol === "ADMIN"
              ? "/dashboard"
              : "/home";
          return Response.redirect(new URL(url, nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
  },

  trustHost: true,
});
