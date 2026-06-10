/**
 * Handler de NextAuth.js v5.
 *
 * Expone los endpoints estándar bajo /api/auth/*:
 *   /api/auth/signin
 *   /api/auth/signout
 *   /api/auth/session
 *   /api/auth/csrf
 *   /api/auth/callback/credentials
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
