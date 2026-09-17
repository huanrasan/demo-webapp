import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { loadConfig } from "@/server/config";
import { es } from "./_content/es";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadConfig().BUSINESS_NAME };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // El nonce de CSP se genera por petición: todas las páginas se renderizan de forma dinámica.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const config = loadConfig();

  return (
    <html lang="es">
      <head>
        {/* Color de marca validado (contraste 4,5:1) en config.ts; CSP no permite atributos style. */}
        <style
          nonce={nonce}
        >{`:root{--primary:${config.BRAND_PRIMARY_COLOR};--ring:${config.BRAND_PRIMARY_COLOR};--primary-foreground:#ffffff}`}</style>
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <a
          href="#contenido"
          className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:outline-2 focus:outline-offset-2 focus:outline-foreground"
        >
          {es.skipToContent}
        </a>
        <header className="border-b">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <p className="text-lg font-semibold">{config.BUSINESS_NAME}</p>
          </div>
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 focus:outline-none"
        >
          {children}
        </main>
      </body>
    </html>
  );
}
