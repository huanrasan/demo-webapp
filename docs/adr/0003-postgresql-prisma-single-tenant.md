# 0003. Persistir en PostgreSQL con Prisma, una base por instalación y restricciones de integridad en la base

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** huanrasan (architect)
**Advice from:** Agente IA (propuesta inicial). Pendiente: data-steward, security
**Supersedes:** -

## Context and problem
Cada negocio tiene su instalación (single-tenant). Las reservas no pueden solaparse para el mismo profesional o recurso
(métrica "reservas dobles = 0" de `discovery.md`). Los instantes se guardan en UTC y se muestran en
`BUSINESS_TIMEZONE`. Datos personales `confidential` bajo Ley 1581. `AGENTS.md` declara PostgreSQL con Prisma.

Momento de decidir: ahora; la primera migración y el cliente de datos forman parte de la estructura inicial.

## Decision drivers
| Criterio | Peso |
|---|---|
| Integridad: imposibilidad de reservas dobles incluso con peticiones concurrentes | 5 |
| Migraciones versionadas, revisables y reversibles | 4 |
| Productividad y tipado en TypeScript | 3 |
| Portabilidad (PostgreSQL estándar, sin extensiones propietarias) | 3 |

## Options considered
1. **Prisma ORM 7** (`@prisma/adapter-pg`, `prisma.config.ts`) con migraciones SQL generadas y editadas a mano para
   restricciones que Prisma no modela (exclusión por rango de tiempo).
2. **Drizzle ORM** con migraciones SQL.
3. **SQL directo** (`pg` + consultas tipadas a mano).
4. Do nothing / defer: bloquea todas las features.

## Trade-off analysis
| Criterion (weight) | Prisma 7 | Drizzle | SQL directo | Do nothing |
|---|---|---|---|---|
| Integridad (5) | 4: `EXCLUDE` en SQL de migración; Prisma no lo modela | 4: igual | 5 | 0 |
| Migraciones (4) | 5: `migrate dev/deploy`, historial en tabla | 4 | 2: herramienta aparte | 0 |
| Productividad (3) | 5: adapter Prisma soportado por Better Auth | 4 | 2 | 0 |
| Portabilidad (3) | 4 | 4 | 5 | 0 |
| **Total ponderado** | **67** | **60** | **54** | **0** |

## Decision
Opción 1, con estas reglas:

- **Una base de datos por instalación**; sin columna de tenant.
- **PostgreSQL 17** (AWS RDS en producción, imagen oficial `postgres:17` en Docker Compose).
- **Instantes** como `timestamptz` en UTC; la zona del negocio solo se aplica al presentar (`domain`).
- **Prevención de reservas dobles en la base**: extensión `btree_gist` y restricción
  `EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'confirmed')`,
  añadida en SQL dentro de la migración de la feature de reservas. El dominio valida antes, pero la base es la garantía.
- **Migraciones expand/contract**: cada despliegue es compatible con la versión anterior del código; `prisma migrate
  deploy` corre como paso previo al despliegue (tarea única), nunca al arrancar cada contenedor.
- **Borrado de clientes por anonimización** (reemplazo de nombre, email y teléfono) para conservar la integridad de
  agenda y métricas; detalle en `data.md`.
- **Mínimo privilegio**: usuario `app` con DML sobre el esquema de la app; usuario `migrator` con DDL, usado solo por la
  tarea de migración.

Modelo conceptual para las features (se materializa en cada cambio `feature`): `User` (rol `customer` | `staff` |
`admin`), `Session`, `Account`, `Verification`, `TwoFactor`, `Passkey` (Better Auth); `Consent` (versión de política,
aceptada en); `Service`; `Resource` (profesional o sala); `WorkingHours`; `TimeOff`; `Booking` (origen `self` |
`staff`, estado `confirmed` | `cancelled` | `no_show` | `attended`); cola de tareas en esquema `pgboss` (ADR-0004).

## Advice received
Ninguna externa todavía. Aceptado por huanrasan (architect) el 2026-09-17; el recibo `sdlc approve` y la revisión del PR lo formalizan.

## Consequences
- Positive: la integridad de agenda no depende del código; migraciones auditables en el repo.
- Negative / accepted trade-offs: SQL manual para `EXCLUDE` fuera del esquema Prisma (documentado en la migración);
  cambios a Prisma 7 recientes (driver adapters obligatorios).
- Follow-up actions: test de integración concurrente (dos reservas simultáneas al mismo recurso y hora → una falla).

## Revisit triggers
- Consultas p95 > 100 ms en rutas críticas con índices correctos.
- Paso a multi-tenant.
- Prisma deja de soportar el adapter `pg` o Better Auth deja el adapter Prisma.
