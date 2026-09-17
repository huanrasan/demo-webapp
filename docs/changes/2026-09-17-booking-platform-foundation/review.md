# Review: base de la plataforma de reservas

- Reviewer (agent/model or person): Claude Opus 5 (agente revisor independiente)
- Fresh context (did not see implementation session): yes
- Verdict: changes-requested

Segunda pasada sobre el commit `1d04b30` ("fix: corregir los hallazgos de la revisión independiente"). La primera
pasada revisó `git diff origin/main...HEAD` hasta `ec691cb` (108 archivos) y produjo 15 hallazgos; esta pasada verifica
`git diff ec691cb..HEAD` (31 archivos) contra `spec.md`, `design.md`, `plan.md`, `threat-model.md`, `verification.md` y
ADR-0001..0005. El revisor sigue sin acceso a la sesión de implementación.

De los 15 hallazgos previos: **12 resueltos y verificados**, **2 aceptados explícitamente** (siguen abiertos como
riesgo) y **1 no resuelto: la corrección lo sustituyó por un vector más directo**. Además aparecen **6 hallazgos
nuevos**, cinco de ellos introducidos por las propias correcciones.

## Comandos ejecutados por el revisor (segunda pasada)
| Comando | Resultado |
|---|---|
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0 — 7 archivos / 21 tests |
| `pnpm test:integration` (con `docker compose up -d --wait db mail`) | exit 0 — 3 archivos / **8** tests, 4 ejecuciones seguidas sin fallos |
| `pnpm build` | exit 0; tabla de rutas = `/`, `/_not-found`, `/api/health` (**sin** `/e2e/error`) |
| `pnpm build` con `.env` retirado y sin variables | exit 0 — el step `Build (AC-1)` de CI, que ya no carga `.env.ci`, funciona |
| `pnpm build:e2e` + `pnpm test:e2e` | exit 0 — **9** passed; el build e2e sí enruta `ƒ /e2e/error` |
| `node .next/routes-manifest.json` tras `pnpm build` | `["/","/_global-error","/_not-found","/api/health","/favicon.ico"]`; `grep -rl e2e/error .next` sin resultados |
| `docker build -t booking:review2 .` | exit 0, 1,02 GB |
| `curl / ` con `purpose: prefetch` y con `next-router-prefetch` | CSP, HSTS, `nosniff`, `Referrer-Policy` y `x-request-id` presentes en ambos casos; sin `X-Powered-By` |
| `curl /e2e/error` y `curl /nope` en la imagen | 404 y 404 |
| `docker exec` `id -u` / `command -v yarn` / `ls /opt` | 1000 / `none` / sin `yarn-v*` |
| contenedor con `DATABASE_URL` a puerto cerrado | 503 + log `{"level":"warn","event":"health_degraded","check":"database","reason":"error","errorName":"PrismaClientKnownRequestError"}` |
| `trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 booking:review2` | exit 0, sin hallazgos |
| `env -u MIGRATION_DATABASE_URL pnpm db:status` | exit 1, "Configuración inválida o incompleta en: MIGRATION_DATABASE_URL" |
| `env -u MIGRATION_DATABASE_URL pnpm exec prisma generate` | exit 0 — la validación no rompe el `postinstall` |
| prueba de `redact` de pino con las claves nuevas | `set-cookie`, `apiKey`, `password`, `secret` redactados; anidación de 5 niveles **no** redactada (límite documentado) |
| `python3 .harness/sdlc.pyz check` / `arch` | OK: 0 error(s), 0 warning(s) |

`approvals.toml`: la aprobación de `design.md` se reemitió (`architect`, 21:56:09 UTC) porque su hash cambió; el
recibo anterior se retiró. Es el flujo esperado y `sdlc check` lo valida.

## Findings
| Severity | Location | Finding | Recommendation |
|---|---|---|---|
| medium | `.github/workflows/ci.yml:56`, `:61`, `:68` | **Regresión del hallazgo M-2, no resuelto.** La corrección sustituyó `>> "$GITHUB_ENV"` por `set -a; . ./.env.ci; set +a`, que **ejecuta** el archivo como script de shell en vez de solo leerlo. Demostrado localmente: añadiendo `INJECTED=$(echo RCE-DEMO)` a una copia de `.env.ci` y haciendo `. ` sobre ella, la sustitución de comandos se ejecuta y la variable toma el valor. `.env.ci` es modificable desde un PR y el workflow dispara en `pull_request` sobre un repositorio público, así que el comentario de las líneas 53-54 ("un PR no debe poder inyectar variables en el entorno del job editando ese archivo") no se cumple: se pasó de inyección de variables a ejecución directa de comandos en el runner. El impacto sigue acotado (token de solo lectura, sin secretos en jobs de `pull_request`), pero el control es más débil que antes | Declarar los valores en un bloque `env:` del propio workflow (son fijos y no secretos) o, si debe leerse el archivo, parsearlo sin evaluarlo (`while IFS='=' read -r k v; do case "$k" in ''\|\#*) continue;; esac; export "$k=$v"; done < .env.ci`). En ningún caso `source`/`.` sobre un archivo que un PR puede editar |
| low | `src/components/ui/skeleton.tsx:1`, `src/app/_content/es.ts:21` | **Introducido por la corrección del hallazgo de código muerto.** Al eliminar `loading.tsx` quedaron huérfanos `Skeleton` (ningún import en `src/` ni en `tests/`) y la clave `es.loading`. Se retiraron cuatro componentes sin uso y se crearon dos elementos nuevos sin uso | Eliminar ambos y recuperarlos con el primer estado de carga por segmento, igual que se decidió para `Input`, `Label`, `Alert` y `FormMessage` en `plan.md` |
| low | `prisma.config.ts:8` | La guarda dispara con `process.argv.some((arg) => arg.includes("migrate") \|\| arg.includes("db"))`, que inspecciona **todos** los elementos de `argv`, incluido `argv[1]`, la ruta absoluta del CLI de Prisma. Cualquier checkout cuya ruta contenga `db` o `migrate` (p. ej. `/home/runner/work/booking-db/booking-db` o `~/dev/dbtools/…`) haría fallar `prisma generate` —que corre en el `postinstall` de cada `pnpm install`— con "Configuración inválida o incompleta en: MIGRATION_DATABASE_URL". No se pudo reproducir con un symlink porque Node resuelve la ruta real; es un hallazgo de lectura de código, no observado | Mirar solo el subcomando: `const cmd = process.argv[2]` y comparar contra una lista explícita (`migrate`, `db`) |
| low | `package.json:18`, `playwright.config.ts:20` | `test:e2e` ahora ejecuta `pnpm build:e2e && playwright test`, así que la suite e2e ya no se ejecuta contra el artefacto que producen `pnpm build` y el `Dockerfile`: la evidencia de AC-6 y AC-7 sale de un build con `pageExtensions` distinto. Además deja `.next` con la ruta de prueba, de modo que un `pnpm start` posterior en local sirve `/e2e/error`; y en CI el resultado del step `Build (AC-1)` lo pisa el rebuild de `test:e2e` | Construir el bundle e2e en un `distDir` aparte, o reconstruir con `pnpm build` al terminar la suite. Como mínimo, documentar que tras `pnpm test:e2e` el `.next` local no es un build de producción |
| low | `src/server/logger.test.ts:51` | La lista de fugas del test de AC-10 incluye `expect(lines[0]).not.toContain("?")`: un solo signo de interrogación en cualquier parte de la línea JSON rompe el test. Hoy pasa, pero queda acoplado a contenido incidental (cualquier frame del stack, mensaje o ruta que lleve `?`) | Afirmar sobre la query string real (`"email=ana@example.com"`, `"tel=3001234567"`) en lugar de un `?` suelto |
| low | `src/server/logger.ts:24-25` | El comentario dice "se cubren los tres primeros niveles" mientras que las rutas generadas cubren cuatro (`key`, `*.key`, `*.*.key`, `*.*.*.key`). Comprobado: un `email` en el quinto nivel de anidación **no** se redacta. El límite real conviene que esté bien escrito porque es el que acota el control de T-12 | Corregir el comentario a cuatro niveles y dejar constancia de que más allá de ese punto la protección depende de no registrar objetos profundos |

## Trazabilidad de los 15 hallazgos de la primera pasada
| # | Hallazgo original | Estado | Evidencia del revisor |
|---|---|---|---|
| 1 | high — `src/proxy.ts`: los headers de seguridad se evitaban con `purpose: prefetch` / `next-router-prefetch` | **resuelto** | `src/proxy.ts:21-23` usa `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]` sin `missing:`. En la imagen: ambas cabeceras devuelven CSP con `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy` y `x-request-id`. Nuevo test `tests/e2e/security-headers.spec.ts:22` que recorre los dos casos |
| 2 | high — `loading.tsx` de la raíz forzaba HTTP 200 en errores y 404 | **resuelto** | `src/app/loading.tsx` eliminado. `tests/e2e/accessibility.spec.ts:46` afirma `response?.status() === 500` y pasa; en la imagen `/nope` devuelve 404. Documentado en `design.md §Estados de carga`. Matiz inherente al SSR en streaming: un error posterior al primer flush seguiría siendo 200; ya no es el caso garantizado |
| 3 | medium — `/api/health` pasaba a 503 sin log ni métrica | **resuelto (log); métrica pendiente)** | `src/server/health.ts:36-43` emite `health_degraded` con `check`, `reason` (`timeout`/`error`) y `errorName`; `src/app/api/health/route.ts:8` inyecta el logger; nuevo test de integración. Verificado en contenedor con la base inaccesible. La métrica que pide `design.md §Observability` sigue sin emitirse, dentro de la brecha general de métricas EMF ya señalada |
| 4 | medium — `ci.yml` volcaba `.env.ci` en `$GITHUB_ENV` | **no resuelto** | Ver el primer hallazgo de la tabla anterior: `source` sobre un archivo modificable desde un PR es un vector más directo que el original |
| 5 | medium — AC-9: `enforce_admins=false` y sin `required_pull_request_reviews` | **aceptado, abierto** | Sin cambios en la protección de rama. `verification.md` lo registra como "accepted (pendiente)". Sigue sin anotarse en `.harness/deviations.toml` con vencimiento, que es donde el harness lo haría caducar |
| 6 | medium — ruta de prueba enrutable en la imagen de producción | **resuelto** | `src/app/e2e/error/page.e2e.tsx` + `next.config.ts:4-5` (`pageExtensions` con `e2e.tsx` solo si `E2E_ROUTES=1`). `pnpm build` produce solo `/`, `/_not-found`, `/api/health`; `grep -rl "e2e/error" .next` vacío; en la imagen `find /app/.next -name '*e2e*'` vacío y `/e2e/error` → 404. El flag `ENABLE_E2E_ROUTES` desapareció de `playwright.config.ts` |
| 7 | low — `X-Powered-By: Next.js` | **resuelto** | `next.config.ts:9` `poweredByHeader: false`; verificado con curl en la imagen; test e2e `no expone el framework en los headers` |
| 8 | low — `RequestLike.headers` sin uso volvía vacuas las aserciones de AC-10 | **resuelto** | Campo eliminado en `src/server/logger.ts:41` y en `src/instrumentation.ts:24`. `src/server/logger.test.ts:41-52` ahora afirma la lista exacta de 11 claves emitidas, que es una aserción real sobre la lista blanca de `design.md` |
| 9 | low — `redact` de pino: un nivel y claves faltantes | **resuelto** | `src/server/logger.ts:3-15,24-25`: se añaden `set-cookie`, `password`, `secret`, `apiKey` y cuatro niveles de rutas. Comprobado fuera del repo que las cuatro claves nuevas se redactan. Queda el detalle del comentario (hallazgo low de esta pasada) |
| 10 | low — cuatro componentes de UI sin uso | **resuelto, con efecto colateral** | `alert.tsx`, `input.tsx`, `label.tsx` y `form-message.tsx` eliminados y registrado en `plan.md`. Pero `Skeleton` y `es.loading` quedaron huérfanos (hallazgo low de esta pasada) |
| 11 | low — `apt-get upgrade` rompe la reproducibilidad del digest | **aceptado** | `Dockerfile:25-27`: se mantiene y el comentario explica el intercambio (parches del sistema antes que reproducibilidad bit a bit). Decisión razonable y ahora explícita |
| 12 | low — yarn seguía en la imagen | **resuelto** | `Dockerfile:29-30` borra `/opt/yarn-v*`, `/usr/local/bin/yarn` y `yarnpkg`. En la imagen: `command -v yarn` → `none`, `ls /opt \| grep -c yarn` → 0 |
| 13 | low — `MIGRATION_DATABASE_URL` sin validar | **resuelto** | `prisma.config.ts:7-11` y `design.md §Variables de entorno`. `pnpm db:status` sin la variable termina con código 1 y el mismo formato de mensaje de AC-5; `prisma generate` no se ve afectado. Queda la fragilidad de la heurística de `argv` (hallazgo low de esta pasada) |
| 14 | low — `plan.md`/`design.md` nombraban osv-scanner en vez de Trivy fs | **resuelto** | Corregido en `plan.md` T-15 y en `design.md §Deployment` |
| 15 | low — los dos tests del worker compartían cola | **resuelto** | `tests/integration/worker.test.ts:42` detiene el worker al final del primer test y desaparece el `afterAll`. 4 ejecuciones seguidas de la suite de integración en verde (8 tests) |

Sin hallazgos nuevos en: reglas de capas (`sdlc arch` en verde), validación de configuración, aislamiento de secretos,
privilegios de base, fijación por SHA/digest en workflows, tamaño y usuario de la imagen, y conformidad con
ADR-0001, 0003, 0004 y 0005. `ux.md` mantiene en la fila de componentes una mención residual a `FormMessage` y `Alert`
en la columna de errores pese a haberlos retirado de la lista: inconsistencia menor de documentación, no se abre como
hallazgo porque el resto de la fila ya recoge la decisión.

## Checklist
Marcado = dimensión efectivamente revisada por el revisor en este repositorio, en las dos pasadas; el resultado de cada
revisión está en Findings y en la tabla de trazabilidad.

- [x] Acceptance criteria implemented and tested — AC-1..AC-8 y AC-10..AC-12 verificados y reproducidos; **AC-6 ahora sí se cumple** (comprobado con las dos cabeceras de prefetch y con test e2e propio); **AC-9 sigue cumpliéndose solo parcialmente**, aceptado por el product owner
- [x] Scope limited to plan — el commit `1d04b30` se limita a los hallazgos de la revisión y a la documentación asociada; las desviaciones quedan registradas en `plan.md`. Sin restos de depuración ni tests comentados
- [x] Security (input, authn/authz, secrets, dependencies, privileges) — sin authn/authz en este cambio; verificados headers, ruta de prueba fuera de producción, redacción de datos personales, dependencias (Trivy de imagen en verde) y permisos de CI. **Abierto: la carga de `.env.ci` en CI pasó a ejecutar el archivo**
- [x] Conforms to accepted ADRs / contracts compatible — `sdlc arch` en verde; `design.md` actualizado y su aprobación de `architect` reemitida sobre el contenido nuevo
- [x] Operability (telemetry, flags, rollback) — errores de servidor con 5xx y `health_degraded` en logs, ambos verificados en el contenedor. Sigue pendiente la emisión de las métricas EMF que describe `design.md §Observability`
- [x] Tests meaningful and not flaky — 21 unit, 8 integración (4 ejecuciones seguidas) y 9 e2e con aserciones reales, incluidos ahora los códigos de estado HTTP y la lista exacta de claves del log. Hallazgos menores: `not.toContain("?")` y el build e2e que no es el de producción
- [x] Verification evidence reproducible — todas las afirmaciones nuevas de `verification.md` (9 tests e2e, 8 de integración, disposición de cada hallazgo) se reprodujeron; la única disposición que no se sostiene es la del hallazgo de `$GITHUB_ENV`, marcada como "fixed"

## Not reviewed
- Ejecuciones reales de CI en GitHub para el commit `1d04b30`: se revisaron las definiciones de los workflows y se
  reprodujeron sus comandos localmente, pero no hay un run posterior a este commit que inspeccionar.
- Evidencia SARIF/CycloneDX de gitleaks, Semgrep, Trivy fs y Syft: se genera en CI y no se commitea. El escaneo de
  imagen sí se reprodujo sobre la imagen reconstruida.
- Comportamiento de `notFound()` dentro de una página en producción: la única página que lo usaba se eliminó, así que
  solo se comprobó el 404 de ruta inexistente.
- El caso de error posterior al primer flush del streaming SSR (seguiría respondiendo 200): no hay ruta que lo provoque
  en este cambio.
- `pnpm-lock.yaml` más allá de los tres paquetes con override; el lockfile no cambió en esta pasada.
- Contenido de `discovery.md`, `data.md` y `cost.md` como artefactos de decisión ya aprobados.
- Infraestructura AWS de ADR-0005: no existe en este cambio, llega en la fase release.
- Revisión manual con lector de pantalla y medición de p95 con 20 usuarios concurrentes: `verification.md` ya las
  declara pendientes y el revisor tampoco las ejecutó.
- `release.md` y `runbook.md` siguen siendo plantillas sin rellenar; corresponden a fases posteriores.
