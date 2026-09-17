// Textos de la interfaz (es-CO, tuteo). Centralizados para revisión de contenido (ux.md).
export const es = {
  skipToContent: "Saltar al contenido",
  home: {
    title: (business: string) => `Reserva tu turno en ${business}`,
    intro: "Consulta la disponibilidad y reserva en línea en cualquier momento.",
    bookCta: "Reservar un turno",
    comingSoon: "Disponible pronto.",
  },
  notFound: {
    title: "No encontramos esta página",
    body: "Es posible que el enlace esté incompleto o que la página ya no exista.",
    backHome: "Volver al inicio",
  },
  error: {
    title: "Algo salió mal",
    body: "No pudimos completar la acción. Intenta de nuevo en unos segundos.",
    retry: "Intentar de nuevo",
    reference: (code: string) => `Código de referencia: ${code}`,
  },
} as const;
