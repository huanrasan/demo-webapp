import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { loadConfig } from "@/server/config";
import { es } from "./_content/es";

export default async function Home() {
  // Next.js renderiza la página en paralelo al layout: también debe esperar a la petición antes de leer la configuración.
  await connection();
  const { BUSINESS_NAME } = loadConfig();

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">{es.home.title(BUSINESS_NAME)}</h1>
      <p className="text-muted-foreground">{es.home.intro}</p>
      {/* Se habilita con la feature de disponibilidad y reserva. */}
      <Button size="lg" disabled aria-describedby="reserva-pronto">
        {es.home.bookCta}
      </Button>
      <p id="reserva-pronto" className="text-sm text-muted-foreground">
        {es.home.comingSoon}
      </p>
    </section>
  );
}
