# 0001. Construir un monolito Next.js single-tenant con capas de dominio aisladas

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** huanrasan (architect)
**Advice from:** Agente IA (propuesta inicial). Pendiente: security, platform
**Supersedes:** -

## Context and problem
La plataforma de reservas necesita interfaz para clientes, panel del personal, API interna, tareas programadas y acceso
a PostgreSQL (`docs/changes/2026-09-17-booking-platform-foundation/spec.md`). El equipo es de una persona, el
piloto es pequeño (≤ 200 reservas/día) y cada negocio tiene su propia instalación. `AGENTS.md` ya fija Next.js
(App Router, TypeScript), PostgreSQL con Prisma, Vitest y Playwright como stack del repositorio.

Momento de decidir: ahora; la estructura inicial del código depende de esta decisión.

## Decision drivers
| Criterio | Peso |
|---|---|
| Simplicidad operativa para un equipo de una persona | 5 |
| Reglas de reserva testeables sin framework ni base de datos | 4 |
| Portabilidad entre plataformas de contenedores | 4 |
| Coherencia con el stack declarado en `AGENTS.md` | 3 |
| Capacidad de separar componentes más adelante | 2 |

## Options considered
1. Monolito Next.js full-stack (UI + route handlers + server actions) con capas `domain` / `server` / `app` y un
   proceso worker separado construido desde la misma imagen.
2. SPA (React) + API separada (Node/Fastify) + worker: tres artefactos desplegables.
3. Do nothing / defer: sin estructura acordada; cada feature decide.

## Trade-off analysis
| Criterion (weight) | Monolito Next.js por capas | SPA + API separada | Do nothing |
|---|---|---|---|
| Simplicidad operativa (5) | 5: una imagen, dos procesos | 2: tres artefactos, CORS, versionado de API | 1: deriva de estructura |
| Reglas testeables (4) | 4: `domain` puro, reglas de arquitectura ejecutables | 4: igual con disciplina | 1 |
| Portabilidad (4) | 4: imagen Node estándar (`output: "standalone"`) | 4 | 3 |
| Coherencia con AGENTS.md (3) | 5 | 2 | 3 |
| Separación futura (2) | 3: `domain` y `server` se extraen si hace falta | 5 | 1 |
| **Total ponderado** | **78** | **58** | **32** |

## Decision
Opción 1. Estructura:

- `src/domain/**`: reglas de negocio puras (disponibilidad, solapamientos, políticas de cancelación, zona horaria).
  No importa `next`, `react`, `@prisma/client`, `@aws-sdk/*`, `pg-boss` ni `better-auth`.
- `src/server/**`: casos de uso y adaptadores (repositorios Prisma, envío de email, cola de tareas, autenticación).
  Puede importar `domain`; no importa `app`.
- `src/app/**` y `src/components/**`: rutas, pantallas y componentes de Next.js. Importan `server` y `domain`.
- `src/worker/**`: punto de entrada del proceso de tareas programadas. Importa `server` y `domain`; no importa `app`.

Las reglas se hacen ejecutables en `.harness/architecture.toml` citando este ADR. Runtime Node.js 24 (Active LTS a la
fecha), Next.js 16, TypeScript estricto, pnpm.

## Advice received
Ninguna externa todavía. Aceptado por huanrasan (architect) el 2026-09-17; el recibo `sdlc approve` y la revisión del PR lo formalizan. Se solicita revisión de security (superficie de server actions) y platform (imagen única con
dos comandos).

## Consequences
- Positive: un solo artefacto desplegable; reglas de reserva cubiertas con tests unitarios rápidos; frontera verificada
  por `sdlc arch` en CI.
- Negative / accepted trade-offs: server actions y route handlers comparten proceso con el renderizado (un pico de
  tráfico afecta ambos); acoplamiento al ciclo de versiones de Next.js.
- Follow-up actions: configurar capas en `.harness/architecture.toml`; alias `@/domain`, `@/server` en `tsconfig`.

## Revisit triggers
- Más de un cliente de la API (app móvil, integraciones) que requiera contrato público versionado.
- p95 del servidor > 500 ms sostenido con CPU del contenedor > 70 % pese a escalar horizontalmente.
- Decisión de producto de pasar a multi-tenant.
