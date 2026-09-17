# Review: base de la plataforma de reservas

- Reviewer (agent/model or person): Claude Opus 5 (agente revisor independiente)
- Fresh context (did not see implementation session): yes
- Verdict: changes-requested

Alcance revisado: `git diff origin/main...HEAD` en `feat/booking-platform-foundation` (PR #2, HEAD `ec691cb`, 108
archivos), contra `spec.md`, `design.md`, `plan.md`, `threat-model.md`, `verification.md` y ADR-0001..0005.

## Comandos ejecutados por el revisor
| Comando | Resultado |
|---|---|
| `pnpm lint` | exit 0, 0 errores |
| `pnpm format:check` | exit 0, "All matched files use Prettier code style!" |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0, 7 archivos / 21 tests |
| `pnpm test:integration` (con `docker compose up -d db mail`) | exit 0, 3 archivos / 7 tests; repetido 3 veces, sin fallos |
| `pnpm build` | exit 0 (`next build` + `dist/worker.mjs`) |
| `pnpm test:e2e` | exit 0, 7 passed (chromium) |
| `python3 .harness/sdlc.pyz check` | OK: 0 error(s), 0 warning(s) |
| `python3 .harness/sdlc.pyz arch` | OK: 0 error(s), 0 warning(s) |
| `docker build -t booking:review .` | exit 0, imagen de 1,02 GB |
| `docker run ... migrate deploy` | "No pending migrations to apply." (AC-2) |
| `docker run ... booking:review` + `curl /api/health` + `id -u` | `{"status":"ok","db":"ok"}` 200, uid 1000 (AC-8) |
| `trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1` | exit 0, sin hallazgos |
| `actionlint` / `zizmor --offline .github/workflows` | exit 0 / "No findings to report (18 suppressed)" |
| `gh api repos/huanrasan/demo-webapp/branches/main/protection` | checks requeridos correctos; `enforce_admins=false`, sin `required_pull_request_reviews` |
| `npm view lodash version` | 4.18.1 — confirma que el override `^4.18.0` resuelve a una versión publicada |

Todas las cifras de `verification.md` (21 / 7 / 7 tests, salidas de lint, formato, build, gates) se reprodujeron sin
desviaciones. Las tres CVE de dependencias están efectivamente corregidas en `pnpm-lock.yaml` (lodash 4.18.1,
mysql2 3.24.4, deepmerge-ts 8.0.2) y la disposición "false positive" sobre lodash es correcta.

## Findings
| Severity | Location | Finding | Recommendation |
|---|---|---|---|
| high | `src/proxy.ts:22-29` | La cláusula `missing:` del matcher exime del proxy a toda petición que traiga `next-router-prefetch` o `purpose: prefetch`. Comprobado contra la imagen de esta rama: `curl -H 'purpose: prefetch' http://localhost:3100/` devuelve la página de inicio HTML completa (9788 bytes, `<html …>`, HTTP 200) **sin** `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` ni `x-request-id`. AC-6 exige esos headers en cualquier página HTML; el header lo elige el cliente, así que el control completo se evita con una cabecera. `tests/e2e/security-headers.spec.ts:5` solo pide `/` sin esa cabecera y no puede detectarlo | Aplicar el proxy a todas las peticiones (quitar `missing:`) o, si hay que distinguir payloads RSC, seguir emitiendo los headers en esa rama. Añadir un caso e2e que envíe `purpose: prefetch` y `next-router-prefetch` y afirme los cuatro headers |
| high | `src/app/loading.tsx:4`, `src/app/e2e/error/page.tsx:5-6` | El `loading.tsx` de la raíz mete cada página en un límite de Suspense, así que el shell HTTP se emite antes de renderizar el cuerpo y el estado ya no se puede cambiar. Comprobado en la imagen: `/e2e/error` con `ENABLE_E2E_ROUTES=true` responde **HTTP 200** mostrando la pantalla "Algo salió mal", y sin el flag responde **HTTP 200** con el cuerpo de 404 (`NEXT_HTTP_ERROR_FALLBACK;404` en el payload RSC) pese a que el comentario del archivo afirma "Responde 404 salvo en e2e". Los errores de render del servidor y los `notFound()` dentro de páginas llegan al ALB, a los healthchecks y a los buscadores como 200, lo que inutiliza la alarma `ALB 5xx > 1 %` que `design.md §Failure modes` designa como señal principal de detección | Afirmar `response.status()` en `tests/e2e/accessibility.spec.ts:45` (y 404 en la ruta sin flag), y eliminar el `loading.tsx` de la raíz o bajarlo a un segmento que no fuerce el flush temprano del shell |
| medium | `src/server/health.ts:10-13` | La sonda descarta el error (`.then(() => true, () => false)`) y la rama de timeout tampoco lo registra: al pasar a 503 no se emite ninguna línea de log ni métrica. `design.md §Observability` exige eventos estructurados con `event`, y el runbook no puede distinguir un timeout de una conexión rechazada | Registrar un evento `health_degraded` con `errorName` y la clase de fallo (nunca la cadena de conexión) y emitir la métrica correspondiente |
| medium | `.github/workflows/ci.yml:53` | `grep -Ev '^(#|$)' .env.ci >> "$GITHUB_ENV"` vuelca contenido de un archivo del repo literalmente en `$GITHUB_ENV`. Al ser el repositorio público y dispararse en `pull_request`, cualquiera que abra un PR puede editar `.env.ci` e inyectar variables arbitrarias (p. ej. `NODE_OPTIONS`) en el job `integration`, que después ejecuta `pnpm build` y los tests. El impacto está acotado (token de solo lectura, sin secretos), pero zizmor suprime esta clase por defecto (18 hallazgos suprimidos, confirmado localmente), así que el linter no la cubre | Cargar el archivo dentro de cada step (`set -a; . ./.env.ci; set +a`) o enumerar las variables explícitamente en un bloque `env:` |
| medium | `docs/changes/2026-09-17-booking-platform-foundation/verification.md:37` (AC-9) | La protección de `main` verificada por API tiene los checks correctos (`quality, integration, container, workflows, harness, sensors`, `strict: true`, sin force push ni borrado), pero `enforce_admins.enabled = false` y **no existe** bloque `required_pull_request_reviews`. AC-9 pide que "el PR queda bloqueado si alguno falla"; la única cuenta que puede mergear (administrador) está exenta justamente de ese bloqueo, así que el criterio no se cumple tal como está escrito | Activar `enforce_admins` o registrar la excepción con vencimiento en `.harness/deviations.toml` en lugar de solo anotarla en `verification.md`; añadir `required_pull_request_reviews` cuando el flujo de PR abiertos por bot esté operativo |
| medium | `src/app/e2e/error/page.tsx:1-7` | La ruta de prueba se compila y queda enrutable en la imagen de producción (verificado: `/e2e/error` responde en `booking:review`). Su interruptor `ENABLE_E2E_ROUTES` no está en el esquema zod de `src/server/config.ts`, ni en `.env.example`, ni en la lista de variables de `design.md`, así que un valor perdido activa en producción un endpoint que lanza excepciones no controladas sin que AC-5 lo detecte | Excluir la ruta del build de producción, o añadir `ENABLE_E2E_ROUTES` al esquema y rechazar `true` cuando `NODE_ENV=production` |
| low | `next.config.ts:3` | `poweredByHeader` no se desactiva: todas las respuestas llevan `X-Powered-By: Next.js` (verificado en la imagen). Divulga el framework y contradice el criterio de `design.md` de no exponer versión ni tecnología en respuestas | Añadir `poweredByHeader: false` a `nextConfig` |
| low | `src/server/logger.ts:28,36` | `RequestLike.headers` se recibe y nunca se lee en `logServerError`. Por eso las aserciones de AC-10 en `src/server/logger.test.ts:41` sobre `cookie`, `authorization` y `Bearer` pasan de forma vacua: no existe ninguna ruta de código que pudiera emitirlos | Quitar el campo sin uso, o registrar una lista blanca de headers para que el test guarde algo real; mantener las aserciones sobre `logger.info`, que sí ejercitan el `redact` de pino |
| low | `src/server/logger.ts:12-14` | `redact` solo cubre el nivel superior y un nivel de anidación (`*.${key}`), y `SENSITIVE_KEYS` omite `set-cookie`, `password`, `secret` y `apiKey`. Un objeto más profundo (`{ a: { b: { email } } }`) se registra tal cual | Ampliar las rutas de redacción y la lista de claves, o invertir a lista blanca de campos permitidos como dice `design.md §Observability` |
| low | `src/components/ui/alert.tsx:1`, `src/components/ui/input.tsx:1`, `src/components/ui/label.tsx:1`, `src/components/form-message.tsx:1` | Ningún archivo de `src/` ni de `tests/` importa estos cuatro componentes (~114 líneas): es código muerto, sin test ni render, que igualmente entra en la imagen. `plan.md` tarea 9 los autoriza, pero la base no los necesita | Añadirlos con la primera feature que los use, o dejar constancia explícita de por qué se pre-cargan |
| low | `Dockerfile:27` | `RUN apt-get update && apt-get upgrade -y` anula la reproducibilidad que busca el digest fijado en `Dockerfile:3`: el mismo Dockerfile produce imágenes distintas según el día, y el resultado "Trivy 0 hallazgos" no se puede reproducir solo con el digest | Subir el digest de la imagen base (el ecosistema `docker` de Dependabot ya está configurado) en lugar de actualizar paquetes en build |
| low | `Dockerfile:28` | La etapa final elimina `npm`, `npx` y `corepack` pero deja `yarn` 1.22.22 en `/opt/yarn-v1.22.22` (visible en el inventario de Trivy de la imagen construida). El comentario de las líneas 25-26 afirma haber reducido la superficie a `node` | Eliminar también `/opt/yarn*` y `/usr/local/bin/yarn*` en el mismo `rm -rf` |
| low | `src/server/config.ts:10-25`, `.env.example:4`, `prisma.config.ts:11` | `MIGRATION_DATABASE_URL` se usa en `prisma.config.ts` y se documenta en `.env.example` y `.env.ci`, pero no está en el esquema zod ni en la lista de variables de `design.md`. Un valor ausente o mal formado falla como error de Prisma durante `migrate deploy`, no con la salida que nombra la variable de AC-5 | Validarla en el camino de migración y añadirla a la tabla de variables de `design.md` |
| low | `.github/workflows/sdlc-gates.yml:77-80` | `plan.md` T-15 y `design.md §Deployment` nombran `pnpm audit` / `osv-scanner` como SCA; el pipeline real usa Trivy fs y osv-scanner no se ejecuta en ningún sitio. La tabla de Deviations del plan no recoge el cambio | Corregir `plan.md`/`design.md` o añadir la fila de desviación correspondiente |
| low | `tests/integration/worker.test.ts:37,52` | El primer test deja un worker en proceso suscrito a `system.heartbeat` hasta el `afterAll`, mientras el segundo lanza otro worker sobre la misma cola y base; ambos compiten por los mismos trabajos y el primero muta estado compartido con `deleteQueuedJobs`. `fileParallelism: false` no aísla dos workers dentro del mismo archivo. No reprodujo fallos en 3 ejecuciones seguidas, pero el acoplamiento es real | Detener el primer worker antes de lanzar el proceso hijo, o usar un nombre de cola distinto por test |

Sin hallazgos en: reglas de capas (`sdlc arch` en verde; `domain` no importa framework ni `server`/`app`/`worker`),
validación de configuración (zod cubre IANA, longitud de secreto, contraste y dependencias condicionales de transporte,
y `ConfigError` nunca imprime valores — comprobado en `config.test.ts` y con arranque real), aislamiento de secretos
(`.gitignore` cubre `.env*` salvo `.env.example` y `.env.ci`, sin credenciales reales), privilegios de base
(`docker/postgres/init/01-roles.sh` separa `migrator` DDL de `app` DML y `app` no puede crear esquemas), fijación por
SHA de las acciones y por digest de las imágenes de los escáneres tocadas en este cambio, `permissions: contents: read`
en `ci.yml`, y la conformidad con ADR-0001, 0003, 0004 y 0005 en lo que este cambio implementa.

## Checklist
Marcado = dimensión efectivamente revisada por el revisor en este repositorio; el resultado de cada revisión está en
Findings.

- [x] Acceptance criteria implemented and tested — AC-1..AC-5, AC-7, AC-8, AC-10..AC-12 verificados y reproducidos; **AC-6 no se cumple** (hallazgo high de `src/proxy.ts`) y **AC-9 se cumple solo parcialmente** (hallazgo medium de branch protection)
- [x] Scope limited to plan — todo lo entregado corresponde a las tareas 1-17 de `plan.md`; sin restos de depuración ni tests comentados. Excepciones señaladas: componentes UI sin uso y ruta `/e2e/error` en la imagen de producción
- [x] Security (input, authn/authz, secrets, dependencies, privileges) — sin authn/authz en este cambio (llega con ADR-0002); revisados validación de entrada, manejo de secretos, redacción de datos personales, overrides de dependencias, permisos de CI y privilegios de base. Hallazgos: proxy, `$GITHUB_ENV`, `/e2e/error`, redacción del logger, `X-Powered-By`, yarn en la imagen
- [x] Conforms to accepted ADRs / contracts compatible — `sdlc arch` en verde y capas respetadas; sin API pública, `[contracts] files = []` coherente con `design.md`
- [x] Operability (telemetry, flags, rollback) — hallazgos: errores de servidor con HTTP 200, 503 de health sin log ni métrica; las 9 métricas EMF de `design.md §Observability` no se emiten todavía (no hay tarea que las difiera explícitamente). Migración inicial vacía y rollback documentados y verificados como idempotentes
- [x] Tests meaningful and not flaky — aserciones reales, sin esperas fijas (`waitFor` por condición); hallazgos: falta de aserción de estado HTTP en el e2e de error, aserciones vacuas de headers en `logger.test.ts`, acoplamiento entre los dos tests del worker
- [x] Verification evidence reproducible — los 9 comandos de `verification.md`, el build y arranque de la imagen, Trivy de imagen, actionlint y zizmor se reprodujeron con resultados idénticos; la disposición "false positive" de lodash se confirmó contra el registro npm

## Not reviewed
- Ejecuciones reales de CI en GitHub (runs 35262099478 y 35262099470): se revisaron las definiciones de los workflows
  y se reprodujeron sus comandos localmente, pero no se inspeccionaron los logs de los jobs.
- Evidencia SARIF/CycloneDX de gitleaks, Semgrep, Trivy fs y Syft: se genera en CI y no se commitea, así que solo se
  verificó la configuración que la produce, no los resultados. El escaneo de imagen sí se reprodujo.
- El PR de prueba #3 que sustenta AC-9: ya está cerrado y la rama eliminada; solo se verificó el estado actual de la
  protección de rama por API y que PR #2 está en `mergeStateStatus: BLOCKED`.
- `pnpm-lock.yaml` (10 272 líneas) más allá de los tres paquetes con override y de comprobar que
  `pnpm install --frozen-lockfile` y el build funcionan.
- Contenido de `discovery.md`, `ux.md`, `data.md` y `cost.md` como artefactos de decisión ya aprobados; solo se usaron
  como referencia para contrastar el código.
- Infraestructura AWS de ADR-0005 (ECS, ALB, RDS, SES, alarmas, IaC): no existe en este cambio, llega en la fase release.
- Revisión manual con lector de pantalla y medición de p95 con 20 usuarios concurrentes: `verification.md` ya las
  declara pendientes y el revisor tampoco las ejecutó.
- `release.md` y `runbook.md` siguen siendo plantillas sin rellenar; corresponden a fases posteriores y no se evaluaron.
