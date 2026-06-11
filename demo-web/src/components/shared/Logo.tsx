/**
 * Logo de Scorpions D.L. Private Security.
 *
 * Usa next/image para optimización automática (resize, lazy-load, WebP).
 * El archivo origen es /public/logo.png — PNG con fondo transparente,
 * así el escudo se ve limpio sobre cualquier color de fondo.
 *
 * Tamaños predefinidos:
 *   sm  → 32px  (chip pequeño, top bars mobile)
 *   md  → 48px  (sidebar header)
 *   lg  → 72px  (header destacado)
 *   xl  → 140px (pantalla de login, splash)
 */

import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  className?: string;
  /** Si es true, agrega un disco blanco detrás del logo (útil sobre fondos claros, donde el amarillo se pierde). */
  withBackground?: boolean;
  priority?: boolean;
}

const SIZE_MAP: Record<LogoSize, number> = {
  sm: 32,
  md: 48,
  lg: 72,
  xl: 140,
};

export function Logo({
  size = "md",
  className,
  withBackground = false,
  priority = false,
}: LogoProps) {
  const px = SIZE_MAP[size];

  const img = (
    <Image
      src="/logo.png"
      alt="Scorpions D.L. Private Security"
      width={px}
      height={px}
      priority={priority}
      className={cn("block h-auto w-auto object-contain", className)}
      style={{ maxWidth: px, maxHeight: px }}
    />
  );

  if (!withBackground) return img;

  return (
    <div
      className="flex items-center justify-center rounded-full bg-white p-1 shadow-md ring-1 ring-black/10"
      style={{ width: px + 8, height: px + 8 }}
    >
      {img}
    </div>
  );
}
