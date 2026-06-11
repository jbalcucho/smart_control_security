-- AlterEnum: extender TipoMarca con los nuevos valores para refrigerio
ALTER TYPE "TipoMarca" ADD VALUE 'SALIDA_REFRIGERIO';
ALTER TYPE "TipoMarca" ADD VALUE 'ENTRADA_REFRIGERIO';

-- AlterTable: foto opcional para soportar marcas de refrigerio sin selfie
ALTER TABLE "Marca" ALTER COLUMN "fotoUrl" DROP NOT NULL,
ALTER COLUMN "fotoKey" DROP NOT NULL;
