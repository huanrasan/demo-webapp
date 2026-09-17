import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@/server/security-headers";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestId = crypto.randomUUID();
  const headers = securityHeaders({ nonce, production: process.env.NODE_ENV === "production" });

  // Next.js lee el nonce del header CSP de la petición para aplicarlo a sus scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("Content-Security-Policy", headers["Content-Security-Policy"]);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  response.headers.set("x-request-id", requestId);
  return response;
}

// Sin exclusiones por cabecera: el cliente las elige y podría saltarse los headers de seguridad.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
