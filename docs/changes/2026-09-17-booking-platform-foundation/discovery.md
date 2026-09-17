---
status: proposed
---
# Discovery: plataforma de reservas para negocios con citas

## Problem
Negocios pequeños que trabajan con citas (consultorios, estudios, gimnasios) gestionan turnos por teléfono,
mensajería o planillas. Consecuencias habituales: tiempo del personal dedicado a agendar, dobles reservas,
ausencias sin aviso (no-shows) y clientes que no pueden reservar fuera del horario de atención.

**Evidencia: ninguna recolectada todavía.** Todo lo anterior es supuesto del product owner y debe validarse
(ver "Assumptions to validate"). No hay entrevistas, datos de uso ni tickets que lo respalden a la fecha.

## Target users
- **Cliente final**: quiere ver horarios libres y reservar o cancelar en cualquier momento sin llamar, y recordar su cita.
- **Personal del negocio** (recepción, profesional, administrador): quiere definir horarios y servicios, ver la agenda
  del día y gestionar reservas sin conflictos ni trabajo manual.

Modelo de despliegue decidido: **un negocio por instalación** (single-tenant). Multi-tenant queda fuera.

## Value hypothesis
We believe that autoservicio de reservas con recordatorios por email for negocios pequeños con citas y sus clientes
will result in menos tiempo del personal agendando y menos ausencias. We will know we are right when the success
metrics below move.

## Success metrics
| Metric | Baseline | Target | Measured by |
|---|---|---|---|
| % de reservas creadas por autoservicio (vs. cargadas por el personal) | Desconocida: sin sistema actual | ≥ 70 % a 8 semanas del lanzamiento | Campo de origen de la reserva en la base de datos |
| Tasa de no-show | Desconocida: el negocio piloto la registra 4 semanas antes del lanzamiento | −30 % relativo a la línea base | Estado de asistencia marcado por el personal en el panel |
| Tasa de cancelación con ≥ 24 h de anticipación | Desconocida | ≥ 60 % de las cancelaciones | Timestamps de cancelación vs. inicio del turno |
| Reservas dobles (conflictos) | Desconocida | 0 | Restricción en base de datos + contador de conflictos rechazados |

Medición: las métricas salen de los datos propios de la app; el diseño debe incluir origen de reserva, estado de
asistencia y timestamps. Las líneas base requieren un negocio piloto que registre datos antes del lanzamiento.

## Options
| Option | Summary | Value | Effort | Risk |
|---|---|---|---|---|
| Do nothing | Seguir con teléfono, mensajería y planillas | Nulo | Nulo | Continúan no-shows y carga manual |
| Adoptar un SaaS existente (p. ej. herramientas de agenda comerciales) | Configurar un producto de terceros | Medio-alto, rápido | Bajo | Costo recurrente por negocio, datos personales en un tercero, poca personalización |
| Construir app propia single-tenant | Next.js + PostgreSQL desplegable en cualquier plataforma de contenedores | Alto: control de datos y personalización | Alto | Mantener seguridad, autenticación y envío de email propios |
| Construir app propia multi-tenant (SaaS) | Una instalación para muchos negocios | Alto a escala | Muy alto | Aislamiento de datos entre negocios, alta de negocios; descartado para el primer incremento |

## Assumptions to validate
| Assumption | How we validate it (prototype, experiment, data) | Result |
|---|---|---|
| Los clientes prefieren reservar online a llamar | Piloto con un negocio: % de reservas autoservicio en 4 semanas | Pendiente |
| Los recordatorios por email reducen no-shows | Comparar la tasa de no-show del piloto contra su línea base previa | Pendiente |
| El personal adopta el panel en lugar de la planilla | Entrevista y observación del personal en semana 2 del piloto | Pendiente |
| El email es un canal suficiente (sin SMS/WhatsApp) | Tasa de apertura de recordatorios y feedback del piloto | Pendiente |
| Construir supera a adoptar un SaaS para este caso | Comparar costo total y requisitos de datos con 2 SaaS del mercado antes del diseño | Pendiente |

## Decision
Decision: go

Propuesta del agente; requiere aprobación del product owner. Primer incremento (este cambio de arquitectura): decisiones de stack, autenticación, modelo de datos, envío de email y
estructura inicial de la aplicación con CI. Las capacidades de producto llegan en cambios `feature` separados, en orden:
registro e inicio de sesión → disponibilidad y reserva → cancelación → recordatorios por email → panel del personal.

Fuera de alcance explícito: multi-tenant, pagos, SMS/WhatsApp, apps móviles nativas, integración con calendarios
externos y cualquier dato clínico (motivo de consulta, notas). Las reservas guardan solo datos mínimos: nombre,
email, teléfono, servicio y horario.
