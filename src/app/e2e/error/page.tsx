import { notFound } from "next/navigation";

// Ruta de prueba para la pantalla de error (tests/e2e/accessibility.spec.ts). Responde 404 salvo en e2e.
export default function E2eError() {
  if (process.env.ENABLE_E2E_ROUTES !== "true") notFound();
  throw new Error("Error de prueba e2e");
}
