# Plataforma de reservas

Aplicación web de reservas para negocios que trabajan con citas (consultorios, estudios, gimnasios). Los clientes se
registran, ven la disponibilidad, reservan y cancelan turnos y reciben recordatorios por email; el personal gestiona
horarios y reservas desde un panel. Una instalación por negocio.

**Estado:** en construcción. Este repositorio contiene la base técnica (estructura, base de datos, seguridad,
observabilidad y CI). Las capacidades de producto llegan en cambios posteriores.

## Requisitos

- Node 24 (`.nvmrc`) y pnpm
- Docker (PostgreSQL 17 y Mailpit locales)

## Arranque local

```bash
pnpm install
cp .env.example .env          # completa BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d db mail  # PostgreSQL en 5432, Mailpit en 8025
pnpm db:migrate
pnpm dev                      # http://localhost:3000
pnpm worker                   # en otra terminal: tareas programadas (requiere pnpm build:worker)
```

Los emails enviados en desarrollo se leen en Mailpit: http://localhost:8025

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Construye la app y el worker (`dist/worker.mjs`) |
| `pnpm start` | Sirve la app construida |
| `pnpm test` | Tests unitarios (Vitest) |
| `pnpm test:integration` | Tests contra PostgreSQL y Mailpit reales |
| `pnpm test:e2e` | Tests de navegador (Playwright), incluye accesibilidad |
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | Calidad de código |
| `pnpm db:dev` / `pnpm db:migrate` / `pnpm db:status` | Migraciones (usuario `migrator`) |

## Estructura

- `src/domain`: reglas de negocio puras (sin framework ni base de datos)
- `src/server`: configuración, acceso a datos, email, cola, logging
- `src/app`, `src/components`: rutas y pantallas (Next.js App Router)
- `src/worker`: proceso de tareas programadas (pg-boss)
- `prisma`: esquema y migraciones
- `docs`: decisiones de arquitectura (`docs/adr`) y registros de cambio (`docs/changes`)

## Cómo se trabaja aquí

Cada cambio no trivial tiene un registro en `docs/changes/<id>/` con especificación, diseño, plan y verificación, y
pasa por los gates del harness SDLC (`python3 .harness/sdlc.pyz check`). Los detalles para agentes de IA están en
`AGENTS.md`.

## Privacidad

La aplicación trata datos personales bajo la Ley 1581 de 2012 (Colombia): solo datos mínimos de contacto y agenda, sin
datos de salud. Ver `docs/changes/2026-09-17-booking-platform-foundation/data.md`.
