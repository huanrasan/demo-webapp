"use client";

import { es } from "./_content/es";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-background text-foreground antialiased">
        <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
          <title>{es.error.title}</title>
          <h1 className="text-3xl font-bold">{es.error.title}</h1>
          <p>{es.error.body}</p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {es.error.retry}
          </button>
          {error.digest && <p className="text-sm">{es.error.reference(error.digest)}</p>}
        </main>
      </body>
    </html>
  );
}
