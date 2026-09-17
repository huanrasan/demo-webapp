import { cn } from "cn";

// Mensaje de validación de un campo: el input lo referencia con aria-describedby y aria-invalid (ux.md).
export function FormMessage({
  id,
  className,
  children,
}: React.ComponentProps<"p"> & { id: string }) {
  if (!children) return null;
  return (
    <p id={id} className={cn("text-sm font-medium text-destructive", className)}>
      {children}
    </p>
  );
}
