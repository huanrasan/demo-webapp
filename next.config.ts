import type { NextConfig } from "next";

// Las páginas *.e2e.tsx solo se enrutan cuando se construye para los tests e2e (pnpm build:e2e):
// la imagen de producción nunca incluye rutas de prueba.
const pageExtensions = ["tsx", "ts"];
if (process.env.E2E_ROUTES === "1") pageExtensions.unshift("e2e.tsx");

const nextConfig: NextConfig = {
  // No revelar el framework en las respuestas (design.md §Interfaces).
  poweredByHeader: false,
  pageExtensions,
};

export default nextConfig;
