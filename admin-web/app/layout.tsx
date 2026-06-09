import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Control Security — Panel Admin",
  description:
    "Panel administrativo para supervisores y administradores del sistema de control de asistencia",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-slate-50 font-sans antialiased text-slate-900">
        {children}
      </body>
    </html>
  );
}
