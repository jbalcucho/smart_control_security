import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Scorpions D.L. — Private Security",
  description:
    "Sistema de control de asistencia y reporte de novedades para guardias de Scorpions D.L. Private Security.",
  applicationName: "Scorpions D.L.",
  appleWebApp: {
    capable: true,
    title: "Scorpions D.L.",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
