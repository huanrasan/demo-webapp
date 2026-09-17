"use client";

import { Button } from "@/components/ui/button";
import { es } from "./_content/es";

// El digest coincide con el campo digest del log del servidor (instrumentation.ts); nunca se muestra error.message.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="space-y-4" role="alert">
      <h1 className="text-3xl font-bold">{es.error.title}</h1>
      <p className="text-muted-foreground">{es.error.body}</p>
      <Button onClick={() => retry()}>{es.error.retry}</Button>
      {error.digest && (
        <p className="text-sm text-muted-foreground">{es.error.reference(error.digest)}</p>
      )}
    </section>
  );
}
