-- CreateEnum
CREATE TYPE "TipoNovedad" AS ENUM ('GENERAL', 'REFUERZO', 'PANICO', 'INFORMATIVA');

-- CreateEnum
CREATE TYPE "EstadoNovedad" AS ENUM ('PENDIENTE', 'EN_ATENCION', 'RESUELTA', 'DESCARTADA');

-- AlterEnum
ALTER TYPE "TipoAlerta" ADD VALUE 'NOVEDAD_PANICO';
ALTER TYPE "TipoAlerta" ADD VALUE 'NOVEDAD_REFUERZO';

-- AlterTable
ALTER TABLE "Alerta" ADD COLUMN     "novedadId" TEXT,
ALTER COLUMN "marcaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Novedad" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puestoId" TEXT,
    "tipo" "TipoNovedad" NOT NULL,
    "severidad" "Severidad" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "refuerzosNecesarios" BOOLEAN NOT NULL DEFAULT false,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "precisionM" DOUBLE PRECISION,
    "estado" "EstadoNovedad" NOT NULL DEFAULT 'PENDIENTE',
    "atendidaPor" TEXT,
    "atendidaEn" TIMESTAMP(3),
    "notasSupervisor" TEXT,
    "timestampCliente" TIMESTAMP(3) NOT NULL,
    "timestampServidor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Novedad_estado_severidad_timestampServidor_idx" ON "Novedad"("estado", "severidad", "timestampServidor" DESC);

-- CreateIndex
CREATE INDEX "Novedad_userId_timestampServidor_idx" ON "Novedad"("userId", "timestampServidor" DESC);

-- CreateIndex
CREATE INDEX "Novedad_puestoId_timestampServidor_idx" ON "Novedad"("puestoId", "timestampServidor" DESC);

-- CreateIndex
CREATE INDEX "Novedad_tipo_idx" ON "Novedad"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Alerta_novedadId_key" ON "Alerta"("novedadId");

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "Novedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
