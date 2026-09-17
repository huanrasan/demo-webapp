# Plan: base de la plataforma de reservas

## Traceability
| Requirement / threat | Test(s) | Type |
|---|---|---|
| AC-1 | Job CI `build`: `pnpm install --frozen-lockfile && pnpm build` | integration (CI) |
| AC-2 | Job CI `migrate`: `pnpm db:migrate` dos veces sobre PostgreSQL 17 vacío; la segunda sin cambios (`prisma migrate status` = up to date) | integration (CI) |
| AC-3 | `tests/integration/health.test.ts` › "responde 200 con db ok en menos de 500 ms" | integration |
| AC-4 | `tests/integration/health.test.ts` › "responde 503 sin detalles cuando la base no responde" | integration |
| AC-5 | `src/server/config.test.ts` › "falla nombrando la variable sin imprimir su valor" (faltante, IANA inválida, secreto corto, color sin contraste) | unit |
| AC-6 | `tests/e2e/security-headers.spec.ts` › CSP con nonce, `nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`; HSTS con `NODE_ENV=production` | e2e |
| AC-7 | `tests/e2e/accessibility.spec.ts` › inicio, 404 y error: `lang="es"` y cero violaciones axe `serious`/`critical` | e2e |
| AC-8 | Job CI `container`: build de imagen, `docker run`, `curl /api/health` = 200, `docker exec id -u` ≠ 0 | integration (CI) |
| AC-9 | Workflow `ci.yml` como check requerido + PR de prueba con un test roto que queda bloqueado y se cierra sin merge (evidencia en `verification.md`) | manual + CI |
| AC-10 | `src/server/logger.test.ts` › "error 500 con email en query y cookie no filtra datos"; `tests/integration/health.test.ts` › "la respuesta 503 no incluye stack" | unit + integration |
| AC-11 | `src/domain/time.test.ts` › "guarda UTC y formatea en America/Bogota"; "cruza cambio de horario en America/Santiago" | unit |
| AC-12 | `python3 .harness/sdlc.pyz check` con ADR-0001..0005 `Accepted` y aprobados | harness gate |
| T-1 | Feature de registro: tests de token de un solo uso, expiración a 10 min, GET no consume token | integration (feature) |
| T-2 | Feature de registro: respuesta y tiempo iguales para email existente e inexistente | integration (feature) |
| T-3 | Feature de registro: rate limit por IP y por email (429); alarma SES en IaC (release) | integration (feature) |
| T-4 | Feature de registro: test estático `requireStaff()` en `src/app/(staff)/**` + e2e de rutas del panel | unit + e2e (feature) |
| T-5 | Feature de reserva: tests IDOR de lectura, cancelación y modificación | integration (feature) |
| T-6 | Feature de registro: e2e de enrolamiento TOTP/passkey, bloqueo tras 5 fallos, revocación de sesiones | e2e (feature) |
| T-7 | Este cambio: `eslint.config.mjs` prohíbe `dangerouslySetInnerHTML` y `$queryRawUnsafe` (`tests/lint/forbidden-patterns.test.ts` sobre el fixture `tests/lint/fixtures/forbidden.fixture.tsx`); CSP en `security-headers.spec.ts` | static + e2e |
| T-8 | Este cambio: HSTS en `security-headers.spec.ts`; atributos de cookie en la feature de registro; política TLS del ALB con Checkov en release | e2e + IaC scan |
| T-9 | Feature de reserva: test concurrente de dos reservas al mismo recurso y hora | integration (feature) |
| T-10 | Feature de recordatorios: test de plantillas sin nombre de servicio ni recurso | unit (feature) |
| T-11 | Release: SPF/DKIM/DMARC verificados con `dig` en `release.md` | manual (release) |
| T-12 | Este cambio: `src/server/logger.test.ts` (AC-10) | unit |
| T-13 | Este cambio: imagen no root y sin secretos (job `container`, Trivy); red y RDS con Checkov en release | CI + IaC scan |
| T-14 | Este cambio: gitleaks en pre-commit y CI (`sdlc-evidence/secrets.sarif`); `config.test.ts` (AC-5) | security + unit |
| T-15 | Este cambio: SCA con Trivy fs (SARIF), Trivy de imagen, SBOM CycloneDX con syft; `sdlc evidence check` | security |
| T-16 | Este cambio: actionlint y zizmor en CI sobre `.github/workflows/`; acciones fijadas por SHA | static |
| T-17 | Este cambio: `sdlc check --base origin/main` (sensor `weakened_tests`) en CI | harness gate |
| T-18 | Feature del panel: test de `AuditEvent` al cancelar por personal | integration (feature) |
| T-19 | Release: política de escalado y alarma 5xx en IaC (Checkov + revisión) | IaC scan (release) |
| T-20 | Feature de retención (tras registro y reserva): test de anonimización y métrica de última ejecución | integration (feature) |

## Tasks
Cada tarea es un PR pequeño (< 400 líneas cambiadas, sin contar lockfile ni componentes generados por shadcn), con el
test antes o junto al comportamiento. Paralelizables: 3 con 4; 7 con 8 y 9 (tras 5).

| # | Task | Done when (command or check) | Depends on | Status |
|---|---|---|---|---|
| 1 | Estructura inicial: Next.js 16 + TypeScript estricto + pnpm + Node 24 (`.nvmrc`, `engines`), ESLint (reglas T-7 con fixture), Prettier, Vitest (unit e integración separados), Playwright, alias `@/domain` `@/server` `@/app` `@/components` `@/worker`, `.gitignore` | `pnpm install --frozen-lockfile && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` y `python3 .harness/sdlc.pyz arch` en verde | - | done |
| 2 | Hooks de git: `core.hooksPath` ya apunta a `.harness/hooks`; añadir gitleaks (`--staged --redact`) al pre-commit | `git commit` con un secreto de prueba en un archivo temporal es rechazado (se descarta sin commit) | 1 | done |
| 3 | `src/domain/time.ts` (UTC ↔ `BUSINESS_TIMEZONE`, formato `es-CO`) test-first | `pnpm test -- src/domain/time.test.ts` | 1 | done |
| 4 | `src/server/config.ts` y `.env.example` con zod: variables de `design.md`, validación IANA, longitud de secreto, contraste de `BRAND_PRIMARY_COLOR`; salida con código 1 sin imprimir valores | `pnpm test -- src/server/config.test.ts` y `pnpm start` sin variables termina con código 1 | 1 | done |
| 5 | `src/server/logger.ts` (pino) con lista de campos permitidos, redacción y `requestId` | `pnpm test -- src/server/logger.test.ts` | 4 | done |
| 6 | `docker-compose.yml` (postgres:17 con script de usuarios `app`/`migrator`, Mailpit); Prisma 7 (`prisma.config.ts`, `@prisma/adapter-pg`), migración inicial vacía, scripts `db:migrate` y `db:dev` | `docker compose up -d db && pnpm db:migrate && pnpm db:migrate && pnpm db:status` sin pendientes; el usuario `app` no puede crear tablas en `public` | 4 | done |
| 7 | `GET /api/health` con `SELECT 1` y timeout 300 ms, `Cache-Control: no-store`; tests de integración con PostgreSQL real y con base inaccesible | `docker compose up -d db && pnpm test:integration -- tests/integration/health.test.ts`; `curl` a `pnpm start` con base arriba (200) y detenida (503) | 5, 6 | done |
| 8 | `src/proxy.ts`: nonce CSP, headers de seguridad, HSTS en producción, `requestId` | `pnpm build && pnpm test:e2e -- tests/e2e/security-headers.spec.ts` y `pnpm test -- src/server/security-headers.test.ts` | 5 | done |
| 9 | UI base: Tailwind 4, shadcn/ui (`Button`, `Link`, `Input`, `Label`, `FormMessage`, `Alert`, `Skeleton`), tokens, layout con "Saltar al contenido", inicio, `not-found`, `error`/`global-error` con `requestId`, `loading`; textos en `src/app/_content/es.ts` | `pnpm test:e2e -- tests/e2e/accessibility.spec.ts` | 8 | done |
| 10 | `EmailSender` con adaptadores `smtp` (Mailpit), `ses` (SESv2, cliente inyectable) y `memory`; selección por `EMAIL_TRANSPORT` | `pnpm test -- src/server/email` y `pnpm test:integration -- tests/integration/email-smtp.test.ts` con Mailpit | 4 | done |
| 11 | Worker: `src/worker/index.ts` con pg-boss (esquema `pgboss`), trabajo `system.heartbeat` cada minuto, apagado ordenado con `SIGTERM` ≤ 30 s; script `worker` | `pnpm test:integration -- tests/integration/worker.test.ts` (heartbeat registrado; `SIGTERM` termina con código 0) | 6 | done |
| 12 | `Dockerfile` multi-etapa (`node:24-slim` por digest, `standalone`, usuario no root, comandos `web`/`worker`/`migrate`), `.dockerignore` | `docker build -t booking:local . && docker run --rm -d -p 3000:3000 --env-file .env.ci booking:local` + `curl -fsS localhost:3000/api/health` + `docker exec <id> id -u` ≠ 0; `migrate` y `worker` probados con `--read-only --tmpfs /tmp` | 7, 11 | done |
| 13 | `.github/workflows/ci.yml`: lint, formato, typecheck, unit, `migrate` (AC-2), integración y e2e con servicios PostgreSQL y Mailpit, build, `container` (AC-8), gitleaks, Semgrep, osv-scanner, Trivy, syft (SARIF y SBOM en `sdlc-evidence/`), actionlint, zizmor; acciones fijadas por SHA; `permissions` mínimos | Workflow en verde en el PR; `python3 .harness/sdlc.pyz evidence check` en CI en verde | 1-12 | done (CI se verifica al abrir el PR) |
| 14 | Registrar `test_paths` y `[tdd]` en `harness.toml` (requiere revisión de platform/security por CODEOWNERS) | `python3 .harness/sdlc.pyz check` y `tdd --base main` en verde; revisión del PR pendiente | 13 | done |
| 15 | Actualizar `AGENTS.md` (Better Auth en el stack, comandos reales, `pnpm worker`, `pnpm test:integration`) y `README.md` para humanos (arranque local) | `python3 .harness/sdlc.pyz check` (límite de 150 líneas de `AGENTS.md`) y los comandos del README ejecutados en este repositorio | 13 | done |
| 16 | **Decisión humana:** activar branch protection en `main` con `ci` y `sdlc-gates` como checks requeridos | Salida de `gh api repos/huanrasan/demo-webapp/branches/main/protection` registrada en `verification.md` | 13 | done |
| 17 | **Humano + agente:** PR de prueba con un test roto; confirmar que queda bloqueado y cerrarlo sin merge (AC-9) | PR #3 bloqueado (quality FAILURE, mergeable_state blocked) y cerrado sin merge | 16 | done |

## Environments, data and access
- **Local:** Docker Desktop, Node 24, pnpm; PostgreSQL y Mailpit en Docker Compose. Datos sintéticos únicamente;
  `.env` local fuera del repo, generado desde `.env.example` con un `BETTER_AUTH_SECRET` aleatorio de desarrollo.
- **CI:** GitHub Actions con servicios PostgreSQL 17 y Mailpit; `.env.ci` con valores no secretos de prueba
  (sin credenciales reales). Sin acceso a AWS en este cambio: el adaptador SES se prueba con cliente simulado.
- **Credenciales:** ninguna credencial de nube ni de producción. Branch protection (tarea 16) requiere permisos de
  administrador del repo: la ejecuta el humano.
- **Producción y staging:** fuera de este plan; se aprovisionan con IaC en la fase release.

## Rollback per migration / infrastructure step
- **Migración inicial (tarea 6):** vacía; rollback = eliminar la base local o el servicio de CI. Sin datos.
- **Esquema `pgboss` (tarea 11):** creado por pg-boss; rollback = `DROP SCHEMA pgboss CASCADE` en local/CI
  (sin datos de negocio).
- **CI y branch protection (tareas 13 y 16):** revertir el commit del workflow; desactivar la regla desde la
  configuración del repo (acción humana).
- **Infraestructura AWS:** no hay cambios en este plan.

## Deviations
| Date | Change to plan | Reason |
|---|---|---|
| 2026-09-17 | Un solo PR desde `feat/booking-platform-foundation` con un commit pequeño por tarea, en lugar de un PR por tarea | Decisión de huanrasan: un único mantenedor; la revisión se hace por commit |
| 2026-09-17 | `.env.example` pasa de la tarea 1 a la 4; el alias único `@/*` cubre `@/domain`, `@/server`, `@/app`, `@/components` y `@/worker` | Las variables se definen junto con su validación; un solo alias evita duplicar rutas en `tsconfig` y Vitest |
| 2026-09-17 | Tarea 1 añade al `AGENTS.md` el bloque `nextjs-agent-rules` | `next dev` lo reinserta si falta; tenerlo commiteado mantiene el árbol limpio |
| 2026-09-17 | Tarea 4 añade `src/domain/color.ts` (contraste WCAG) y `src/instrumentation.ts` (valida la configuración al arrancar `web`); `architecture.toml` incluye `src/instrumentation.ts` en la capa `app` | El contraste es una regla pura de dominio; `register()` es el punto de arranque de Next.js 16 para fallar antes de servir |
| 2026-09-17 | Tarea 6: `MIGRATION_DATABASE_URL` (usuario `migrator`) separada de `DATABASE_URL` (usuario `app`); esquema `pgboss` creado por el script de roles con dueño `app`; `pnpm-workspace.yaml` solo permite scripts de instalación de `prisma` y `@prisma/engines` | Mínimo privilegio de ADR-0003 sin dar a `app` permiso de crear esquemas; T-15 |
| 2026-09-17 | Tarea 8: headers en `src/server/security-headers.ts` (probado en unit para desarrollo y producción); el layout raíz llama a `connection()` para renderizar dinámicamente; `BRAND_PRIMARY_COLOR` va entre comillas en `.env.example` | `next start` siempre usa `NODE_ENV=production`, así que el caso de desarrollo solo se prueba en unit; el nonce exige render por petición; `process.loadEnvFile` trata `#` sin comillas como comentario |
| 2026-09-17 | Tarea 9: la pantalla de error muestra `error.digest` de Next.js como código de referencia (en lugar de `requestId`) y `instrumentation.ts` (`onRequestError`) registra `digest` y `requestId` juntos; `Link` es `next/link` con `buttonVariants`; `FormMessage` propio; el enlace a la política de tratamiento se agrega con la feature de registro; ruta `/e2e/error` solo activa con `ENABLE_E2E_ROUTES=true`; dependencia `cn` (MIT, mantenida por shadcn, sin scripts de instalación) añadida por shadcn en lugar de `clsx` + `tailwind-merge`; `src/lib/**` en la capa `app` | Un componente cliente de error no puede leer headers de la petición; el digest correlaciona pantalla y log sin exponer detalles. La política es contenido legal de cada negocio y se exige junto con la autorización en el registro |
| 2026-09-17 | Tarea 11: el worker se empaqueta con esbuild en `dist/worker.mjs` (`pnpm build:worker`, incluido en `pnpm build`; `pnpm worker` lo ejecuta); pg-boss 12 con `createSchema: false` | El diseño previa `node dist/worker.js`; ESM requiere `.mjs`. `app` no tiene permiso para crear esquemas, el esquema `pgboss` lo crea el bootstrap de roles |
| 2026-09-17 | Tarea 12: imagen sin `output: "standalone"` (el worker y `migrate` necesitan `node_modules` de producción); `prisma` pasa a `dependencies` para ejecutar `migrate` en la imagen; `.env.ci` commiteado con valores de prueba no secretos; la página de inicio y `generateMetadata` esperan `connection()` antes de leer la configuración para que `next build` no la necesite. Seguimiento: la imagen pesa 1,02 GB; reducirla antes de release | `standalone` solo traza dependencias de `web`; la configuración solo existe en tiempo de ejecución (Secrets Manager) |
| 2026-09-17 | Tarea 13: `ci.yml` no repite los escáneres de secretos, SAST, dependencias y SBOM (ya están en `sdlc-gates.yml`); ahí se fijaron sus imágenes por digest y se añadió `persist-credentials: false` a los checkout (hallazgos `artipacked` de zizmor). Dependabot cubre además npm, docker y docker-compose | Evita duplicar escaneos y mantiene una sola política de evidencia; los workflows del harness se conservan con `sdlc upgrade` (merge a tres vías) |
| 2026-09-17 | Tarea 15: los comandos del README se verificaron en el repositorio actual, no en un clon limpio | El clon limpio se verifica en CI (`pnpm install --frozen-lockfile` + build + tests) al abrir el PR |
| 2026-09-17 | Tras el primer CI: `pnpm-workspace.yaml` fuerza versiones corregidas de `lodash`, `mysql2` y `deepmerge-ts` (transitivas del CLI de Prisma); la imagen final quita npm, corepack y aplica parches del sistema; el test del worker vacía la cola y usa un límite de 30 s | Trivy reportó 3 CVE altas en dependencias y 6 en la imagen; el test dependía de una cola sin backlog y del límite de 5 s de Vitest |
| 2026-09-17 | Tareas 16 y 17: el repositorio pasó a público porque la protección de ramas exige GitHub Pro en privado; la protección no aplica a administradores por ahora | Decisión de huanrasan tras verificar que el historial no tiene secretos; el mantenedor único quedaría bloqueado hasta resolver el flujo de aprobación |
| 2026-09-17 | Tras la revisión independiente (review.md): el proxy deja de excluir peticiones con cabecera de prefetch; se elimina `loading.tsx` de la raíz para que los errores devuelvan 5xx y los 404 devuelvan 404; la ruta de prueba pasa a `page.e2e.tsx`, incluida solo con `E2E_ROUTES=1`; `/api/health` registra `health_degraded`; CI carga `.env.ci` dentro de cada step; se quitan cuatro componentes de UI sin uso; la imagen elimina también yarn; `prisma.config.ts` valida `MIGRATION_DATABASE_URL` | Hallazgos high y medium del revisor: headers evitables por cabecera, estados HTTP incorrectos, ruta de prueba en la imagen de producción, inyección de variables en CI, 503 sin log y código muerto |
| 2026-09-17 | Los componentes `Input`, `Label`, `Alert` y `FormMessage` que preveía la tarea 9 llegan con la primera feature que los use | Estaban sin importar en ningún sitio: código muerto que igualmente entraba en la imagen |
