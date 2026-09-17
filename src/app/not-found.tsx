import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { es } from "./_content/es";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">{es.notFound.title}</h1>
      <p className="text-muted-foreground">{es.notFound.body}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {es.notFound.backHome}
      </Link>
    </section>
  );
}
