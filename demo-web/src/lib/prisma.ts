/**
 * Cliente singleton de Prisma.
 *
 * En desarrollo, Next.js recarga frecuentemente y crearía conexiones nuevas
 * en cada hot reload. Para evitar exhausto de conexiones, guardamos la
 * instancia en un global.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
