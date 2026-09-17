# Verification: base de la plataforma de reservas

Commit verificado: tras aplicar los hallazgos de review.md (rama feat/booking-platform-foundation, PR #2).
CI: run 35262099478 (sdlc-gates) y 35262099470 (ci), 2026-09-17.

## Commands run
```text
$ pnpm lint                      # eslint . -> 0 errores, 0 advertencias
$ pnpm format:check              # All matched files use Prettier code style!
$ pnpm typecheck                 # tsc --noEmit -> sin errores
$ pnpm test                      # Test Files 7 passed (7) | Tests 21 passed (21)
$ pnpm build:e2e                 # build con la ruta de prueba (E2E_ROUTES=1); pnpm build no la incluye
$ pnpm test:integration          # Test Files 3 passed (3) | Tests 7 passed (7)   (3 ejecuciones seguidas, sin fallos)
$ pnpm build                     # next build OK + node scripts/build-worker.mjs -> dist/worker.mjs
$ pnpm test:e2e                  # 9 passed, chromium (incluye prefetch, X-Powered-By y códigos de estado)
$ python3 .harness/sdlc.pyz check   # OK: 0 error(s), 0 warning(s)
$ python3 .harness/sdlc.pyz arch    # OK: 0 error(s), 0 warning(s)
$ python3 .harness/sdlc.pyz tdd --base main   # OK: 0 error(s), 0 warning(s)

Imagen de contenedor (local, Docker 29.8.0):
$ docker build -t booking:local .                     # OK
$ docker run --read-only --tmpfs /tmp ... booking:local
  GET /api/health -> {"status":"ok","db":"ok"}; GET / -> 200; id -u -> 1000; healthcheck -> healthy
$ docker run ... booking:local node node_modules/prisma/build/index.js migrate deploy   # No pending migrations
$ docker run ... booking:local node dist/worker.mjs   # worker_started; SIGTERM -> worker_stopped, exit 0
$ trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 booking:local   # exit 0, sin hallazgos

CI (PR #2): quality pass, integration pass, container pass, sensors pass, workflows pass,
            dependencies fail (no aplica: requiere GitHub Advanced Security; corregido en 58717d2),
            harness fail (falta la revisión aprobatoria del PR en GitHub).
```

## Acceptance criteria
| ID | Result | Evidence (test name / manual check) |
|---|---|---|
| AC-1 | pass | Job integration de ci.yml: pnpm install --frozen-lockfile y pnpm build terminan con código 0 (run 35262099470) |
| AC-2 | pass | Job integration de ci.yml: pnpm db:migrate dos veces y pnpm db:status sobre PostgreSQL 17 vacío; segunda ejecución sin cambios |
| AC-3 | pass | `responde 200 con db ok en menos de 500 ms` (tests/integration/health.test.ts) |
| AC-4 | pass | `responde 503 sin detalles cuando la base no responde`, `responde 503 si la consulta excede el tiempo límite` y `registra el motivo de la degradación sin exponerlo en la respuesta` |
| AC-5 | pass | `falla nombrando la variable sin imprimir su valor`, `falla si falta una variable obligatoria`, `rechaza un color de marca sin contraste 4,5:1 sobre blanco`, `exige SMTP_URL con transporte smtp y AWS_REGION con transporte ses`, `termina el proceso con código 1 y sin valores en stderr`; además arranque real sin variables termina con código 1 |
| AC-6 | pass | `la página de inicio envía CSP con nonce y headers de seguridad`, `una cabecera de prefetch no evita los headers de seguridad`, `no expone el framework en los headers` y `cada petición recibe un nonce distinto` (e2e); `en desarrollo omite HSTS y permite eval para las herramientas de React` (unit) |
| AC-7 | pass | `inicio en español, con nombre del negocio y sin violaciones graves`, `404 en español con enlace al inicio`, `error del servidor sin detalles técnicos y con código de referencia`, `el primer elemento enfocable salta al contenido` (axe-core, WCAG 2.2 AA) |
| AC-8 | pass | Job container de ci.yml: build de imagen, migrate, arranque con --read-only, curl /api/health = 200 y id -u distinto de 0 |
| AC-9 | pass | Protección de main con checks obligatorios (quality, integration, container, workflows, harness, sensors), sin force push ni borrado. PR de prueba #3 con un test roto: quality FAILURE y mergeable_state blocked; cerrado sin merge y rama eliminada |
| AC-10 | pass | `error 500 con email en query y cookie no filtra datos`, `redacta campos sensibles registrados directamente`, `incluye el digest que la pantalla de error muestra como código de referencia`; comprobado además en el servidor real (log JSON sin el email de la query) |
| AC-11 | pass | `guarda UTC y formatea en America/Bogota`, `cruza cambio de horario en America/Santiago`, `valida identificadores IANA` |
| AC-12 | pass | ADR-0001 a ADR-0005 en estado Accepted con recibo de aprobación del rol architect; sdlc check en verde |

## Security and quality sensors
| Sensor | Tool | Result | Findings |
|---|---|---|---|
| Secrets | gitleaks (SARIF, CI y pre-commit) | pass | 0 resultados |
| SAST | Semgrep OSS p/default (SARIF) | pass | 0 resultados |
| Dependencies / licenses | Trivy fs (SARIF) + Syft CycloneDX | pass | 0 resultados tras corregir 3 CVE altas; 1017 componentes, ninguna licencia denegada |
| IaC / policy | Checkov | n/a | No hay infraestructura como código en este cambio (llega en la fase release) |
| Container | Trivy image (HIGH/CRITICAL, ignore-unfixed) | pass | 0 hallazgos tras quitar npm y corepack y aplicar parches del sistema base |
| Workflows | actionlint + zizmor | pass | 0 hallazgos (18 suprimidos por configuración de zizmor) |
| Arquitectura y TDD | sdlc arch, sdlc tdd | pass | Sin violaciones de capas ni tests debilitados |

## Verificación manual
- Navegador real (Chromium vía Playwright): inicio, 404, pantalla de error y navegación con teclado (Tab al enlace "Saltar al contenido" y foco en el contenido principal).
- **No realizado:** revisión manual con lector de pantalla (VoiceOver) prevista en ux.md, y medición de p95 con 20 usuarios concurrentes. Ambas quedan como pendientes antes del release; este cambio no expone flujos de usuario.

## Hallazgos de la revisión independiente (review.md, veredicto changes-requested)
| Hallazgo | Disposición | Evidencia |
|---|---|---|
| high: los headers de seguridad se evitaban con la cabecera `purpose: prefetch` (src/proxy.ts) | fixed | El matcher ya no excluye peticiones por cabecera; e2e `una cabecera de prefetch no evita los headers de seguridad`; comprobado con curl en el servidor construido |
| high: errores del servidor y 404 respondían HTTP 200 por el `loading.tsx` de la raíz | fixed | Eliminado el Suspense de la raíz: /no-existe devuelve 404 y /e2e/error devuelve 500; e2e afirma `response.status()` |
| medium: `/api/health` pasaba a 503 sin log ni métrica | fixed | `health_degraded` con `reason` (timeout o error) y `errorName`; test `registra el motivo de la degradación sin exponerlo en la respuesta` |
| medium: ci.yml volcaba .env.ci en `$GITHUB_ENV` (inyección desde un PR) | fixed | Cada step carga el archivo en su propia shell; actionlint en verde |
| medium: la ruta de prueba se compilaba en la imagen de producción con un flag sin validar | fixed | La página es `page.e2e.tsx` y solo entra con `E2E_ROUTES=1`; `pnpm build` produce únicamente /, /_not-found y /api/health |
| medium: AC-9 no se cumple del todo porque la protección exime a administradores | accepted (pendiente) | Decisión de huanrasan para no bloquearse mientras el flujo de PR por bot no existe; se activará junto con ese flujo |
| low: `X-Powered-By: Next.js` | fixed | `poweredByHeader: false`; e2e `no expone el framework en los headers` |
| low: `RequestLike.headers` sin uso hacía vacuas las aserciones de AC-10 | fixed | Campo eliminado; el test afirma la lista exacta de claves emitidas y que no aparece la query string |
| low: `redact` de pino solo cubría un nivel y omitía claves | fixed | Tres niveles de anidación y claves `set-cookie`, `password`, `secret`, `apiKey`; test con objeto anidado |
| low: cuatro componentes de UI sin uso | fixed | Eliminados; llegan con la feature que los use (registrado en plan.md) |
| low: yarn seguía en la imagen | fixed | Eliminado junto con npm, npx y corepack |
| low: `apt-get upgrade` rompe la reproducibilidad del digest | accepted | Se prefiere aplicar parches del sistema a esperar la imagen base; documentado en el Dockerfile |
| low: `MIGRATION_DATABASE_URL` sin validar | fixed | `prisma.config.ts` falla con el mismo formato de mensaje que AC-5 cuando falta en comandos de migración |
| low: plan.md y design.md nombraban osv-scanner en vez de Trivy fs | fixed | Corregido en ambos documentos |
| low: los dos tests del worker compartían cola | fixed | El primero detiene su worker antes de que el segundo lance el proceso hijo |

## Findings disposition
| Finding | Disposition (fixed / accepted / false positive) | Rationale | Who |
|---|---|---|---|
| Trivy: CVE-2026-4800 (lodash), GHSA-3f6p-5ww8-9rcr (mysql2), CVE-2026-40345 (deepmerge-ts), transitivas del CLI de Prisma | fixed | Versiones corregidas forzadas en pnpm-workspace.yaml (4.18.0, 3.22.0, 8.0.0); avisos y mantenedores verificados contra la base de avisos de GitHub y el registro npm | agente + tech-lead |
| Trivy imagen: CVE-2026-69152 (brace-expansion), CVE-2026-69192 (ip-address), CVE-2026-73566 (tar) | fixed | Venían del npm incluido en la imagen base; la imagen final ejecuta node directamente y elimina npm y corepack | agente |
| Trivy imagen: CVE-2026-86145, CVE-2026-89157, CVE-2026-89161 (libpcre2) | fixed | apt-get upgrade en la etapa final de la imagen | agente |
| Revisión automática: "los overrides de lodash apuntan a una versión inexistente (máximo 4.17.21)" | false positive | lodash 4.18.1 existe, publicada por jdalton desde lodash/lodash el 2026-04-01; el aviso CVE-2026-4800 indica 4.18.0 como versión corregida | agente |
| Job dependencies de sdlc-gates: "Dependency review is not supported on this repository" | fixed | Requiere GitHub Advanced Security en repositorios privados; el job se limita a repositorios públicos y la cobertura la dan Trivy y el SBOM | agente |
| Test del worker intermitente en local | fixed | Un worker huérfano consumía los trabajos y el cron acumulaba pendientes; el test vacía la cola y usa un límite de 30 s (3 ejecuciones seguidas en verde) | agente |
| Imagen de contenedor de 1,02 GB | accepted | No afecta a la seguridad ni a los criterios de aceptación; reducirla queda como seguimiento antes del release | tech-lead |
| Job harness: faltan las aprobaciones del PR en GitHub | accepted (pendiente de acción humana) | Los recibos locales existen; GitHub no permite que el autor apruebe su propio PR. Requiere otra cuenta revisora o abrir el PR con otra identidad | huanrasan |
| Job harness: faltan las aprobaciones del PR en GitHub | accepted (pendiente de acción humana) | Decidido el 2026-09-17: los PR los abrirá un bot (GitHub App) para que huanrasan pueda aprobarlos. Este PR #2, abierto por huanrasan, seguirá con harness en rojo y debe reabrirse desde el bot o recibir la revisión de un segundo colaborador | huanrasan |
| Protección de ramas no disponible en repositorio privado (HTTP 403, requiere GitHub Pro) | fixed | El repositorio pasó a público el 2026-09-17 por decisión de huanrasan, tras verificar el historial completo con gitleaks (sin secretos; solo correos de ejemplo y alias noreply) | huanrasan |
| La protección no se aplica a administradores (enforce_admins = false) | accepted | Evita bloquear al único mantenedor mientras el flujo de aprobación con bot no está operativo; activarlo es un cambio de una línea cuando lo esté | huanrasan |
