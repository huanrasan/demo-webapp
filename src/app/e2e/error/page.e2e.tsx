import { connection } from "next/server";

// Solo entra en el build cuando E2E_ROUTES=1 (ver next.config.ts y pnpm build:e2e).
// La imagen de producción se construye con `pnpm build` y no contiene esta ruta.
export default async function E2eError() {
  await connection();
  throw new Error("Error de prueba e2e");
}
