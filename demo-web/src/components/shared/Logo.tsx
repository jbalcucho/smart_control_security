/**
 * Logo de Scorpions D.L. Private Security.
 *
 * Usa next/image para optimización automática (resize, lazy-load, WebP).
 * El archivo origen es /public/logo.jpeg (JPEG con escudo amarillo/verde/negro).
 *
 * Tamaños predefinidos:
 *   sm  → 28px  (chip pequeño, botones)
 *   md  → 40px  (top bar, sidebar)
 *   lg  → 64px  (header destacado)
 *   xl  → 120px (pantalla de login, splash)
 */

import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";

interface LogoProps {
  size?: LogoSize;
  className?: string;
  /** Si es true, muestra el logo sobre un fondo circular blanco (útil sobre dark bars). */
  withBackground?: boolean;
  priority?: boolean;
}

const SIZE_MAP: Record<LogoSize, number> = {
  sm: 28,
  md: 40,
  lg: 64,
  xl: 120,
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
      src="/logo.jpeg"
      alt="Scorpions D.L. Private Security"
      width={px}
      height={px}
      priority={priority}
      className={cn("block object-contain", className)}
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
