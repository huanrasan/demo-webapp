import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservas",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // El nonce de CSP se genera por petición: todas las páginas se renderizan de forma dinámica.
  await connection();
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
