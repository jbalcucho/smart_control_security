-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GUARDIA', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoMarca" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('FUERA_GEOFENCE', 'FOTO_INVALIDA', 'HORARIO_FUERA_TURNO', 'GPS_IMPRECISO');

-- CreateEnum
CREATE TYPE "Severidad" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Role" NOT NULL DEFAULT 'GUARDIA',
    "puestoId" TEXT,
    "turnoNombre" TEXT,
    "turnoInicio" TEXT,
    "turnoFin" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Puesto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "radioGeofenceM" INTEGER NOT NULL DEFAULT 100,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Puesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puestoId" TEXT NOT NULL,
    "tipo" "TipoMarca" NOT NULL,
    "fotoUrl" TEXT NOT NULL,
    "fotoKey" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "precisionM" DOUBLE PRECISION NOT NULL,
    "distanciaPuestoM" DOUBLE PRECISION NOT NULL,
    "dentroDelGeofence" BOOLEAN NOT NULL,
    "esFraude" BOOLEAN NOT NULL DEFAULT false,
    "motivoFraude" TEXT,
    "timestampCliente" TIMESTAMP(3) NOT NULL,
    "timestampServidor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "marcaId" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "severidad" "Severidad" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "resueltaPor" TEXT,
    "resueltaEn" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_rol_idx" ON "User"("rol");

-- CreateIndex
CREATE INDEX "User_puestoId_idx" ON "User"("puestoId");

-- CreateIndex
CREATE INDEX "Puesto_activo_idx" ON "Puesto"("activo");

-- CreateIndex
CREATE INDEX "Marca_userId_timestampServidor_idx" ON "Marca"("userId", "timestampServidor" DESC);

-- CreateIndex
CREATE INDEX "Marca_puestoId_timestampServidor_idx" ON "Marca"("puestoId", "timestampServidor" DESC);

-- CreateIndex
CREATE INDEX "Marca_esFraude_timestampServidor_idx" ON "Marca"("esFraude", "timestampServidor" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_marcaId_key" ON "Alerta"("marcaId");

-- CreateIndex
CREATE INDEX "Alerta_resuelta_severidad_createdAt_idx" ON "Alerta"("resuelta", "severidad", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Alerta_tipo_idx" ON "Alerta"("tipo");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marca" ADD CONSTRAINT "Marca_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE CASCADE ON UPDATE CASCADE;
