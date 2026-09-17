// AC-6, threat-model T-7 y T-8.
export function securityHeaders({
  nonce,
  production,
}: {
  nonce: string;
  production: boolean;
}): Record<string, string> {
  const csp = [
    "default-src 'self'",
    // React usa eval en desarrollo para reconstruir stacks del servidor; nunca en producción.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...(production && { "Strict-Transport-Security": "max-age=63072000; includeSubDomains" }),
  };
}
