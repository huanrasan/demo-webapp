import { Skeleton } from "@/components/ui/skeleton";
import { es } from "./_content/es";

export default function Loading() {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">{es.loading}</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-full" />
    </div>
  );
}
