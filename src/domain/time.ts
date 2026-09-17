export type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function formatInBusinessZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(instant);
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

// Convierte la hora de pared del negocio a un instante UTC. Se recalcula el offset una vez porque el
// offset en el instante supuesto puede diferir del real cuando hay cambio de horario entre ambos.
export function businessLocalToUtc(local: LocalDateTime, timeZone: string): Date {
  const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const firstGuess = wall - offsetMinutes(new Date(wall), timeZone) * 60_000;
  return new Date(wall - offsetMinutes(new Date(firstGuess), timeZone) * 60_000);
}
