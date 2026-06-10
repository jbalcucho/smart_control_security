/**
 * Cliente y helpers para almacenamiento de fotos de marcas.
 *
 * Estrategia híbrida para el demo:
 *   - Si AWS_ACCESS_KEY_ID / SECRET / BUCKET están configurados → sube a S3
 *   - Si no → guarda la foto inline como data URL en Postgres
 *
 * Esto permite que el demo funcione sin AWS, y cuando se configure
 * S3 más adelante, el código de la API no cambia.
 *
 * Patrón inspirado en el repo de referencia rotatudisfraz.
 * Para producción, ver docs/seguridad.md sobre SSE-KMS + presigned URLs.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = process.env.S3_BUCKET_NAME;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

/** Marcadores que indican "todavía no configurado" en el .env */
const PLACEHOLDERS = new Set(["", "PENDIENTE", "TODO", "CHANGE_ME"]);

function isPlaceholder(value: string | undefined): boolean {
  return !value || PLACEHOLDERS.has(value.trim().toUpperCase());
}

/**
 * Devuelve true si AWS S3 está realmente configurado con credenciales reales.
 * Si retorna false, las fotos se guardan inline en la BD.
 */
export function isS3Configured(): boolean {
  return (
    !isPlaceholder(ACCESS_KEY) &&
    !isPlaceholder(SECRET_KEY) &&
    !isPlaceholder(BUCKET)
  );
}

function getClient(): S3Client {
  if (!isS3Configured()) {
    throw new Error(
      "AWS no configurado. Revisa AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y S3_BUCKET_NAME en .env",
    );
  }
  return new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: ACCESS_KEY!,
      secretAccessKey: SECRET_KEY!,
    },
  });
}

export interface UploadResult {
  url: string;
  key: string;
  storage: "s3" | "inline";
}

// ============================================================
// Helpers para data URLs
// ============================================================

interface ParsedDataUrl {
  buffer: Buffer;
  contentType: string;
}

/**
 * Parsea una data URL del tipo "data:image/jpeg;base64,...." y devuelve
 * el buffer binario + el content type.
 */
function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match || !match[1] || !match[2]) {
    throw new Error("Formato de data URL inválido (se esperaba base64).");
  }
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, contentType };
}

// ============================================================
// Upload pública (la usa la API)
// ============================================================

/**
 * Sube una foto recibida como data URL (base64) desde el cliente.
 *
 * - Si S3 está configurado: la decodifica y la sube a S3.
 * - Si no: devuelve la misma data URL como fotoUrl y un key sintético
 *   (para que en la BD siempre haya un key único de referencia).
 *
 * Estructura de keys S3:  marcas/{userId}/{YYYY-MM-DD}/{uuid}.{ext}
 * Estructura inline:      local/{userId}/{YYYY-MM-DD}/{uuid}.{ext}
 */
export async function uploadMarcaFotoFromDataUrl(
  userId: string,
  dataUrl: string,
): Promise<UploadResult> {
  const { buffer, contentType } = parseDataUrl(dataUrl);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const extension = contentType.split("/")[1] ?? "jpg";
  const filename = `${uuidv4()}.${extension}`;

  // --- Modo S3 ---
  if (isS3Configured()) {
    const key = `marcas/${userId}/${today}/${filename}`;
    const client = getClient();

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
        },
      }),
    );

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    return { url, key, storage: "s3" };
  }

  // --- Modo inline (sin S3) ---
  // Guardamos la data URL directamente. Útil para el demo.
  // Limitación: cada foto ocupa ~50-100 KB en Postgres.
  const key = `local/${userId}/${today}/${filename}`;
  return { url: dataUrl, key, storage: "inline" };
}

/**
 * Borra una foto. Si está almacenada inline (data URL) no hace nada.
 * Si está en S3, la elimina.
 */
export async function deleteMarcaFoto(key: string): Promise<void> {
  if (key.startsWith("local/") || !isS3Configured()) {
    return;
  }

  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET!,
      Key: key,
    }),
  );
}
