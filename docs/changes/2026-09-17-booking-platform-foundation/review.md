# Review: base de la plataforma de reservas

- Reviewer (agent/model or person): Claude Opus 5 (agente revisor independiente)
- Fresh context (did not see implementation session): yes
- Verdict: changes-requested

Tercera pasada, sobre el commit `8355d66` ("fix(ci): declarar las variables de prueba en el workflow"). El revisor no
ha tenido acceso a ninguna sesión de implementación en ninguna de las tres pasadas.

| Pasada | Base revisada | Hallazgos abiertos al cerrar |
|---|---|---|
| 1ª | `origin/main...ec691cb` (108 archivos) | 15 (2 high, 4 medium, 9 low) |
| 2ª | `ec691cb..1d04b30` (31 archivos) | 6 nuevos (1 medium, 5 low); 12 de los 15 resueltos, 2 aceptados, 1 regresado |
| 3ª | `1d04b30..8355d66` (9 archivos) | **2 nuevos, ambos low**; los 6 de la 2ª pasada resueltos o mitigados |

Estado acumulado: de los 21 hallazgos de las dos primeras pasadas, **19 están resueltos y verificados** y **2 siguen
abiertos como riesgo aceptado por el product owner** (`enforce_admins=false` y el `apt-get upgrade` del `Dockerfile`).
El veredicto sigue en `changes-requested` por los dos hallazgos low de esta pasada; ambos son correcciones de una
línea y ninguno afecta al comportamiento del producto en ejecución. Uno de ellos importa porque `verification.md`
lo cita como evidencia de un control de seguridad que en realidad no se está comprobando.

## Comandos ejecutados por el revisor (tercera pasada)
| Comando | Resultado |
|---|---|
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0 — 7 archivos / 21 tests |
| `pnpm test:integration` | exit 0 — 3 archivos / 8 tests, **3 ejecuciones seguidas** |
| `pnpm build` (desde `.next` limpio) | exit 0; `routes-manifest` = `["/","/_global-error","/_not-found","/api/health","/favicon.ico"]` |
| `pnpm test:e2e` | exit 0 — 9 passed; el build e2e sí enruta `ƒ /e2e/error` |
| `pnpm start` sobre el build de producción + los 6 asserts del step nuevo de `ci.yml` | CSP con `frame-ancestors 'none'`, `nosniff` y HSTS presentes con `purpose: prefetch`; `grep -ci x-powered-by` = **0**; `/no-existe` → 404; `/e2e/error` → 404 |
| `env -u MIGRATION_DATABASE_URL pnpm db:status` (sin `.env`) | exit 1, "Configuración inválida o incompleta en: MIGRATION_DATABASE_URL" |
| `env -u MIGRATION_DATABASE_URL pnpm exec prisma generate` | exit 0 — la guarda nueva no toca el `postinstall` |
| `grep -rn "Skeleton\|es.loading" src tests` | sin resultados; en `src/components/ui/` solo queda `button.tsx` |
| `actionlint` | exit 0 |
| `zizmor --offline .github/workflows` | "No findings to report. Good job! (18 suppressed)" |
| `python3 .harness/sdlc.pyz check` / `arch` | OK: 0 error(s), 0 warning(s) |
| PoC en `bash` del assert `grep -qiv "x-powered-by"` | **exit 0 con `X-Powered-By` presente** — ver el primer hallazgo |

## Findings
| Severity | Location | Finding | Recommendation |
|---|---|---|---|
| low | `.github/workflows/ci.yml:108` | El assert `grep -qiv "x-powered-by" <<<"$headers"` **no puede fallar nunca**: `-v` invierte la selección por línea y `-q` devuelve 0 si se selecciona *alguna* línea, así que con una respuesta multilínea siempre hay líneas sin la cadena. Reproducido en `bash` (el shell por defecto de `ubuntu-latest`) con unas cabeceras que **sí** contienen `X-Powered-By: Next.js`: el comando sale con 0. Los otros cinco asserts del step son correctos (`grep -q` positivo y `test … = "404"`), pero este concreto es una aserción vacua, y `verification.md` (sección "Segunda pasada", fila del hallazgo de los e2e) lo cita como evidencia de "ausencia de `X-Powered-By`" sobre la imagen real. La propiedad sí se cumple —lo verifiqué con `grep -ci` sobre el build de producción y la cubre el e2e `no expone el framework en los headers`—, pero este control concreto no la vigila | Cambiar a `! grep -qi "x-powered-by" <<<"$headers"`. Conviene además comprobar que el step falla de verdad al introducir temporalmente la regresión, antes de volver a citarlo como evidencia |
| low | `docs/changes/2026-09-17-booking-platform-foundation/ux.md:27`, `:42` | `ux.md` no se actualizó en este commit y quedó describiendo componentes que ya no existen: la fila 27 sigue listando `Skeleton` entre los componentes base (eliminado precisamente en `8355d66`) y su columna de errores describe `FormMessage` con `aria-describedby` y `Alert` con `role="alert"` (eliminados en `1d04b30`); la línea 42 marca como cumplido "Error identification and recovery: `FormMessage` vinculado por `aria-describedby`, `aria-invalid`". Es un artefacto de fase que afirma controles de accesibilidad inexistentes en el código entregado | Dejar la fila de componentes en `Button` y `Link`, mover `Skeleton`, `FormMessage` y `Alert` a la columna de "llegan con la feature que los use", y reformular la línea 42 como pendiente. Al cambiar `ux.md` no hace falta reemitir aprobación: no tiene recibo asociado |

Sin hallazgos nuevos en el resto del commit. Comprobaciones que sí pasaron: el job `integration` declara las once
variables de prueba en su bloque `env:` y ningún step lee ni evalúa `.env.ci` (`grep -rn "env.ci" .github` solo
devuelve el `--env-file` del job `container`, que no evalúa el archivo); `BRAND_PRIMARY_COLOR` va entrecomillado en el
YAML, como exige el `#`; la guarda de `prisma.config.ts` compara el subcomando exacto de `process.argv.slice(2)`;
`src/server/logger.test.ts:54` afirma ahora `entry.route === "/api/reservas"` más la ausencia de `email`, teléfono y
`tel=`, que es una aserción sobre el comportamiento real y no sobre contenido incidental; y el comentario de
`src/server/logger.ts:25` ya dice cuatro niveles, que es lo que cubren las rutas de `redact`. La duplicación de
valores entre `.env.ci` y el bloque `env:` del workflow es un riesgo de desincronización conocido y está advertido en
la cabecera de `.env.ci`; es preferible a evaluar un archivo modificable desde un PR, así que no se abre como hallazgo.

## Trazabilidad de los 21 hallazgos anteriores
### Primera pasada (15)
| # | Hallazgo | Estado |
|---|---|---|
| 1 | high — `src/proxy.ts`: headers de seguridad evitables con `purpose: prefetch` / `next-router-prefetch` | resuelto (2ª pasada) — matcher sin `missing:`, e2e propio y curl sobre la imagen |
| 2 | high — `loading.tsx` de la raíz forzaba HTTP 200 en errores y 404 | resuelto (2ª) — `loading.tsx` eliminado; e2e afirma `status() === 500`; `/no-existe` → 404 |
| 3 | medium — `/api/health` pasaba a 503 sin log | resuelto (2ª) — `health_degraded` con `check`, `reason` y `errorName`, verificado en contenedor. La **métrica** que pide `design.md §Observability` sigue pendiente, dentro de la brecha general de métricas EMF |
| 4 | medium — `ci.yml` volcaba `.env.ci` en `$GITHUB_ENV` | **resuelto (3ª)** — la corrección de la 2ª pasada (`set -a; . ./.env.ci`) era peor; ahora las variables están en el bloque `env:` del job |
| 5 | medium — AC-9: `enforce_admins=false`, sin `required_pull_request_reviews` | **aceptado, abierto** — decisión del product owner. Registrarlo en `.harness/deviations.toml` exige firma humana con rol `architect` o `security`; queda planteado para él, y el agente hizo bien en no firmarlo |
| 6 | medium — ruta de prueba enrutable en la imagen de producción | resuelto (2ª) — `page.e2e.tsx` + `pageExtensions` con `E2E_ROUTES=1`; re-verificado en esta pasada: `pnpm build` no la enruta y `/e2e/error` → 404 |
| 7 | low — `X-Powered-By: Next.js` | resuelto (2ª) — `poweredByHeader: false`, verificado con curl y con e2e |
| 8 | low — `RequestLike.headers` sin uso volvía vacuas las aserciones de AC-10 | resuelto (2ª) — campo eliminado; el test afirma la lista exacta de claves emitidas |
| 9 | low — `redact` de pino: un nivel y claves faltantes | resuelto (2ª) — cuatro niveles y claves nuevas, comprobadas fuera del repo |
| 10 | low — cuatro componentes de UI sin uso | resuelto (2ª), con efecto colateral cerrado en la 3ª |
| 11 | low — `apt-get upgrade` rompe la reproducibilidad del digest | **aceptado, abierto** — comentario explícito en `Dockerfile:25-27` con el intercambio razonado |
| 12 | low — yarn seguía en la imagen | resuelto (2ª) — verificado `command -v yarn` → `none` |
| 13 | low — `MIGRATION_DATABASE_URL` sin validar | resuelto (2ª) y endurecido en la 3ª |
| 14 | low — `plan.md`/`design.md` nombraban osv-scanner en vez de Trivy fs | resuelto (2ª) |
| 15 | low — los dos tests del worker compartían cola | resuelto (2ª) — 8 tests de integración, 7 ejecuciones acumuladas en verde |

### Segunda pasada (6)
| # | Hallazgo | Estado | Evidencia del revisor |
|---|---|---|---|
| 16 | medium — `set -a; . ./.env.ci` ejecuta el archivo como script (regresión del #4) | **resuelto** | `.github/workflows/ci.yml:42-55`: las once variables se declaran en `env:` del job. Ningún `run:` menciona `.env.ci`; el único uso restante es `docker run --env-file` en `container`, que no evalúa el archivo. `.env.ci:1-2` lo advierte. actionlint y zizmor en verde |
| 17 | low — `Skeleton` y `es.loading` huérfanos tras borrar `loading.tsx` | **resuelto** | `src/components/ui/skeleton.tsx` eliminado y la clave `loading` fuera de `src/app/_content/es.ts`. `grep -rn` sin resultados; en `src/components/ui/` solo queda `button.tsx`. Queda la referencia en `ux.md` (hallazgo low de esta pasada) |
| 18 | low — la guarda de `prisma.config.ts` inspeccionaba `argv` completo | **resuelto** | `prisma.config.ts:8-9` usa `process.argv.slice(2)` y compara `arg === "migrate"` o `arg === "db"`. `pnpm db:status` sin la variable sale con 1 y el mensaje de AC-5; `prisma generate` no se ve afectado |
| 19 | low — los e2e corren contra el build con rutas de prueba, no contra el artefacto de producción | **mitigado** | Nuevo step `Security headers and status codes on the production image (AC-6)` en el job `container` (`ci.yml:104-110`). Repliqué sus seis asserts contra el build de producción y los seis se cumplen. La mitigación es razonable: no elimina la diferencia de artefacto, pero cubre en la imagen real lo que los e2e comprueban en el build e2e. Uno de los seis asserts no está bien escrito (hallazgo low de esta pasada) |
| 20 | low — `not.toContain("?")` acoplado a contenido incidental | **resuelto** | `src/server/logger.test.ts:54-56`: `expect(entry.route).toBe("/api/reservas")` más la ausencia de `ana@example.com`, `3001234567` y `tel=` |
| 21 | low — el comentario del logger decía tres niveles y cubre cuatro | **resuelto** | `src/server/logger.ts:25` corregido |

## Checklist
Marcado = dimensión efectivamente revisada por el revisor en este repositorio, en las tres pasadas; el resultado de
cada revisión está en Findings y en las tablas de trazabilidad.

- [x] Acceptance criteria implemented and tested — AC-1..AC-8 y AC-10..AC-12 verificados y reproducidos por el revisor; **AC-9 sigue cumpliéndose solo parcialmente** (`enforce_admins=false`), aceptado por el product owner y pendiente de que un humano lo registre como desviación
- [x] Scope limited to plan — `8355d66` se limita a los hallazgos de la segunda pasada y a la documentación asociada; las desviaciones acumuladas están en `plan.md`. Sin restos de depuración ni tests comentados; ya no queda código muerto en `src/`
- [x] Security (input, authn/authz, secrets, dependencies, privileges) — sin authn/authz en este cambio; headers, ruta de prueba fuera de producción, redacción de datos personales, dependencias y permisos de CI verificados. **La inyección desde un PR en CI queda cerrada**; el único resto es un assert de CI que no vigila lo que dice vigilar
- [x] Conforms to accepted ADRs / contracts compatible — `sdlc arch` en verde; `design.md` actualizado con su aprobación de `architect` reemitida. `ux.md` quedó desactualizado (hallazgo low)
- [x] Operability (telemetry, flags, rollback) — errores de servidor con 5xx y `health_degraded` en logs, verificados en contenedor en la pasada anterior. Sigue pendiente la emisión de las métricas EMF que describe `design.md §Observability`
- [x] Tests meaningful and not flaky — 21 unit, 8 de integración (3 ejecuciones seguidas en esta pasada, 7 acumuladas) y 9 e2e, con aserciones reales sobre estados HTTP, rutas y la lista exacta de claves del log; sin esperas fijas ni dependencias de orden
- [x] Verification evidence reproducible — todas las afirmaciones de `verification.md` se reprodujeron, incluida la nueva sobre la imagen de producción. **Excepción**: la evidencia "ausencia de `X-Powered-By`" atribuida al step del job `container` no se sostiene, porque ese assert no puede fallar (la propiedad sí se cumple, pero la comprueba otro test)

## Not reviewed
- Ejecuciones reales de CI en GitHub para `8355d66`: se revisaron las definiciones de los workflows, se pasaron
  actionlint y zizmor, y se replicaron localmente los comandos y los asserts del step nuevo, pero no hay un run
  posterior a este commit que inspeccionar. En particular, el job `container` completo (build de imagen dentro del
  runner) solo se reprodujo por partes: en esta pasada, los asserts contra `pnpm start`; en la anterior, sobre la
  imagen reconstruida.
- Evidencia SARIF/CycloneDX de gitleaks, Semgrep, Trivy fs y Syft: se genera en CI y no se commitea. El escaneo de
  imagen se reprodujo en la pasada anterior (exit 0) y el `Dockerfile` no ha cambiado desde entonces.
- Comportamiento de `notFound()` dentro de una página en producción y errores posteriores al primer flush del
  streaming SSR (seguirían respondiendo 200): no hay ruta en este cambio que provoque ninguno de los dos casos.
- `pnpm-lock.yaml`: no ha cambiado desde la primera pasada, donde se verificaron los tres paquetes con override.
- Contenido de `discovery.md`, `data.md` y `cost.md` como artefactos de decisión ya aprobados.
- Infraestructura AWS de ADR-0005: no existe en este cambio, llega en la fase release.
- Revisión manual con lector de pantalla y medición de p95 con 20 usuarios concurrentes: `verification.md` ya las
  declara pendientes y el revisor tampoco las ejecutó.
- `release.md` y `runbook.md` siguen siendo plantillas sin rellenar; corresponden a fases posteriores.
