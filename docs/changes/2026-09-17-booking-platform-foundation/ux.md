# UX: base de la interfaz (layout, página de inicio y estados globales)

Este cambio no implementa flujos de negocio. Define la base visual y de accesibilidad que heredan las features:
layout, página de inicio, páginas de error y carga, componentes base y tokens. Cada feature tendrá su propio `ux.md`.

## User flows
| Flujo | Entrada | Criterios |
|---|---|---|
| Visitante abre la app | URL raíz | AC-7: página de inicio en español, `lang="es"`, cero violaciones axe `serious`/`critical` |
| Visitante sigue un enlace inexistente | Cualquier URL no definida | Página 404 en español con enlace a inicio |
| Error del servidor | Excepción no controlada | Página de error en español sin detalles técnicos, con `requestId` para soporte (AC-4, AC-10) |
| Carga lenta de una ruta | Navegación con datos del servidor | Estado de carga accesible por segmento, en las features que lo necesiten |
| Navegación por teclado | Tab desde la carga de la página | Enlace "Saltar al contenido" como primer elemento enfocable |

Flujos de negocio previstos para features posteriores (sin diseño en este cambio): registro e inicio de sesión,
búsqueda de disponibilidad y reserva, mis reservas y cancelación, verificación de segundo factor del personal, agenda
del panel.

## Screens and states
| Screen / component | Empty | Loading | Error | Success | Design reference |
|---|---|---|---|---|---|
| Layout raíz (encabezado con nombre del negocio, contenido, pie con enlace a política de tratamiento de datos) | n/a: siempre tiene nombre del negocio desde configuración | n/a: renderizado en servidor | Si falta configuración la app no arranca (AC-5) | Encabezado, `<main id="contenido">`, pie | shadcn/ui + tokens propios (abajo) |
| Página de inicio `/` | n/a: contenido estático | n/a | Hereda página de error global | Título del negocio, descripción breve, botón "Reservar un turno" deshabilitado con texto "Disponible pronto" hasta la feature de reservas | Idem |
| 404 `not-found.tsx` | n/a | n/a | n/a | "No encontramos esta página" + enlace "Volver al inicio" | Idem |
| Error global `error.tsx` / `global-error.tsx` | n/a | n/a | "Algo salió mal. Intenta de nuevo." + botón "Reintentar" + "Código de referencia: <requestId>" | n/a | Idem |
| Carga (por segmento, en features) | n/a | Indicador con `role="status"` y texto oculto "Cargando…"; respeta `prefers-reduced-motion`. No se añade en la raíz: forzaría HTTP 200 en errores y 404 | n/a | n/a | Idem |
| Componentes base: `Button` y enlaces (`next/link` con `buttonVariants`); los de formulario, aviso y carga llegan con la feature que los use | n/a | `Button` con estado `aria-busy` | La pantalla de error usa `role="alert"`; los mensajes de campo (`aria-describedby`, `aria-invalid`) llegan con el primer formulario | Estados de foco visibles | shadcn/ui (Radix UI) sobre Tailwind CSS 4 |

**Design system:** shadcn/ui (componentes copiados al repo, basados en Radix UI, accesibles por defecto) y Tailwind
CSS 4. Motivo: sin dependencia de runtime de un kit cerrado, componentes accesibles probados y personalizables por
negocio vía tokens. No hay archivo de diseño en herramienta externa; la referencia es el código de componentes y una
página interna `/dev/componentes` disponible solo en desarrollo.

**Tokens:** color primario configurable por instalación (`BRAND_PRIMARY_COLOR`) con validación de contraste ≥ 4,5:1
contra blanco al arrancar (si no cumple, la app no arranca y lo informa); neutros fijos; tipografía del sistema
(sin fuentes externas, evita terceros y mejora carga); espaciado base 4 px; radio 8 px.

## Accessibility (WCAG 2.2 AA)
- [x] Keyboard operable, visible focus, logical order: enlace "Saltar al contenido"; anillo de foco de 2 px con contraste ≥ 3:1 (2.4.7, 2.4.11); orden de DOM igual al visual; componentes Radix con manejo de teclado
- [x] Contrast ratios and non-color cues: texto ≥ 4,5:1, elementos de interfaz ≥ 3:1; color primario validado al arrancar; errores con icono y texto, no solo color
- [x] Labels, names and roles for assistive technologies: `lang="es"`; landmarks `header` y `main` (el pie llega con la política de tratamiento, en la feature de registro); botones y enlaces con nombre accesible; las etiquetas de campo se verifican con el primer formulario
- [x] Error identification and recovery: página de error con `role="alert"` y acción "Reintentar"; la identificación de errores por campo (`aria-describedby`, `aria-invalid`) se verifica con el primer formulario
- [x] Responsive / zoom to 200% without loss: layout fluido desde 320 px (1.4.10 Reflow); objetivos táctiles ≥ 24 × 24 px (2.5.8)
- [x] Motion and timing respect user preferences: animaciones desactivadas con `prefers-reduced-motion`; sin límites de tiempo en estas pantallas (la expiración del enlace mágico se diseña en la feature de registro)

Verificación: axe-core en Playwright sobre todas las pantallas de este cambio (AC-7) y revisión manual con teclado y
VoiceOver registrada en `verification.md`.

## Content and localization
- Solo español (Colombia, `es-CO`). Tuteo ("Reserva tu turno", "Intenta de nuevo"). Textos centralizados en
  `src/app/_content/es.ts` para revisión, sin librería de i18n (multi-idioma fuera de alcance).
- Fechas: `Intl.DateTimeFormat('es-CO', { timeZone: BUSINESS_TIMEZONE })`, formato largo "martes, 3 de noviembre de
  2026, 3:30 p. m." (AC-11). Colombia no tiene horario de verano; los tests usan además una zona con cambio de horario.
- Moneda: no aplica (sin pagos).
- Sin soporte de derecha a izquierda (no requerido).

## Validation
- Esta base no cambia un flujo de usuario existente; no se hace test de usabilidad en este cambio.
- Validación automática: axe-core en CI, Lighthouse accesibilidad ≥ 95 en la página de inicio (registro en
  `verification.md`).
- Revisión manual: recorrido con teclado y VoiceOver (macOS) de inicio, 404 y error.
- Las features de registro y reserva harán una prueba con 3 a 5 usuarios del negocio piloto (clientes y personal)
  sobre un prototipo navegable antes de implementar.
