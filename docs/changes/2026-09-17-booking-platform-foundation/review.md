# Review: base de la plataforma de reservas

- Reviewer (agent/model or person): Claude Opus 5 (agente revisor independiente)
- Fresh context (did not see implementation session): yes
- Verdict: ready-for-human-approval

Cuarta y última pasada, sobre los commits `20d646b` y `8aba8dd`. El revisor no ha tenido acceso a ninguna sesión de
implementación en ninguna de las cuatro pasadas. Esto **no es una aprobación**: la aprobación la da un humano con
recibo (`sdlc approve`) y una revisión del pull request, y AC-9 sigue cumpliéndose solo en parte por decisión suya.

| Pasada | Base revisada | Resultado |
|---|---|---|
| 1ª | `origin/main...ec691cb` (108 archivos) | 15 hallazgos (2 high, 4 medium, 9 low) |
| 2ª | `ec691cb..1d04b30` (31 archivos) | 12 resueltos, 2 aceptados, 1 regresado; 6 nuevos (1 medium, 5 low) |
| 3ª | `1d04b30..8355d66` (9 archivos) | los 6 cerrados (5 resueltos, 1 mitigado); 2 nuevos, ambos low |
| 4ª | `8355d66..8aba8dd` (4 archivos) | **los 2 cerrados; ningún hallazgo nuevo** |

**Cierre**: de los 23 hallazgos acumulados, **21 están resueltos y verificados por el revisor** y **2 siguen abiertos
como riesgo aceptado por el product owner**: `enforce_admins=false` en la protección de `main` (por lo que AC-9 se
cumple solo en parte) y el `apt-get upgrade` del `Dockerfile`. Ninguno de los dos es algo que el equipo pueda cerrar
sin una decisión humana, y ambos están documentados en `verification.md` y en el propio código.

## Comandos ejecutados por el revisor (cuarta pasada)
| Comando | Resultado |
|---|---|
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0 — 7 archivos / 21 tests |
| `pnpm test:integration` | exit 0 — 3 archivos / 8 tests, 2 ejecuciones seguidas (9 acumuladas en las cuatro pasadas) |
| `pnpm build` (desde `.next` limpio) | exit 0; `routes-manifest` = `["/","/_global-error","/_not-found","/api/health","/favicon.ico"]` |
| `pnpm test:e2e` | exit 0 — 9 passed |
| Los **seis** asserts del step `Security headers and status codes on the production image (AC-6)`, replicados literalmente bajo `bash -e` contra `pnpm start` sobre el build de producción | exit 0, los seis se cumplen |
| PoC bajo `bash -e` del assert nuevo con `X-Powered-By` **presente** | exit **1** e imprime "X-Powered-By presente": el assert ya puede fallar |
| PoC bajo `bash -e` del assert nuevo con `X-Powered-By` **ausente** | exit 0 y el step continúa |
| PoC bajo `bash -e` de la forma que el revisor había recomendado (`! grep -qi`), sin ser el último comando | **exit 0 con la cabecera presente**: el fallo se traga. La recomendación del revisor era incorrecta |
| `actionlint` | exit 0 (la forma con `if` no dispara SC2251) |
| `zizmor --offline .github/workflows` | "No findings to report. Good job! (18 suppressed)" |
| `python3 .harness/sdlc.pyz check` / `arch` | OK: 0 error(s), 0 warning(s) |

## Findings
| Severity | Location | Finding | Recommendation |
|---|---|---|---|
| info | `docs/changes/2026-09-17-booking-platform-foundation/ux.md:41` | Residuo de la misma deriva que se corrigió en las líneas 27 y 42: el punto "Labels, names and roles for assistive technologies" sigue marcado `[x]` y cita "landmarks `header`/`main`/`footer`" —`src/app/layout.tsx` solo declara `<header>` y `<main>`, no hay `<footer>`— y "`Label` obligatorio en `Input`", componentes eliminados en `1d04b30`. No afecta al código ni a ningún criterio de aceptación (WCAG 2.2 AA no exige `footer`, y los e2e con axe-core pasan). **Se deja como observación y no bloquea**: es una línea que el revisor no señaló en la tercera pasada pudiendo hacerlo, y corregirla ahora sería mover la portería | Al tocar `ux.md` por cualquier otro motivo, dejar la línea como "landmarks `header`/`main`" y diferir `Label`/`Input` a la primera feature con formulario, igual que ya se hizo en la línea 42 |

No hay hallazgos de severidad `low` o superior abiertos en este cambio.

## Trazabilidad de los 23 hallazgos
### Primera pasada (15)
| # | Hallazgo | Estado |
|---|---|---|
| 1 | high — `src/proxy.ts`: headers de seguridad evitables con `purpose: prefetch` / `next-router-prefetch` | resuelto (2ª) |
| 2 | high — `loading.tsx` de la raíz forzaba HTTP 200 en errores y 404 | resuelto (2ª) |
| 3 | medium — `/api/health` pasaba a 503 sin log | resuelto (2ª). La **métrica** de `design.md §Observability` sigue pendiente, dentro de la brecha general de métricas EMF que este cambio no implementa |
| 4 | medium — `ci.yml` volcaba `.env.ci` en `$GITHUB_ENV` | resuelto (3ª), tras una corrección intermedia peor |
| 5 | medium — AC-9: `enforce_admins=false`, sin `required_pull_request_reviews` | **aceptado, abierto** |
| 6 | medium — ruta de prueba enrutable en la imagen de producción | resuelto (2ª) |
| 7 | low — `X-Powered-By: Next.js` | resuelto (2ª) |
| 8 | low — `RequestLike.headers` sin uso volvía vacuas las aserciones de AC-10 | resuelto (2ª) |
| 9 | low — `redact` de pino: un nivel y claves faltantes | resuelto (2ª) |
| 10 | low — cuatro componentes de UI sin uso | resuelto (2ª) |
| 11 | low — `apt-get upgrade` rompe la reproducibilidad del digest | **aceptado, abierto** |
| 12 | low — yarn seguía en la imagen | resuelto (2ª) |
| 13 | low — `MIGRATION_DATABASE_URL` sin validar | resuelto (2ª), endurecido (3ª) |
| 14 | low — `plan.md`/`design.md` nombraban osv-scanner en vez de Trivy fs | resuelto (2ª) |
| 15 | low — los dos tests del worker compartían cola | resuelto (2ª) |

### Segunda pasada (6)
| # | Hallazgo | Estado |
|---|---|---|
| 16 | medium — `set -a; . ./.env.ci` ejecuta el archivo como script | resuelto (3ª) — variables en el bloque `env:` del job `integration` |
| 17 | low — `Skeleton` y `es.loading` huérfanos | resuelto (3ª) |
| 18 | low — la guarda de `prisma.config.ts` inspeccionaba `argv` completo | resuelto (3ª) |
| 19 | low — los e2e corren contra el build con rutas de prueba | mitigado (3ª) — step propio contra la imagen de producción |
| 20 | low — `not.toContain("?")` acoplado a contenido incidental | resuelto (3ª) |
| 21 | low — el comentario del logger decía tres niveles y cubre cuatro | resuelto (3ª) |

### Tercera pasada (2)
| # | Hallazgo | Estado | Evidencia del revisor |
|---|---|---|---|
| 22 | low — `grep -qiv "x-powered-by"` no podía fallar nunca | **resuelto** | `.github/workflows/ci.yml:110` usa `if grep -qi "x-powered-by" <<<"$headers"; then echo "X-Powered-By presente"; exit 1; fi`. Verificado bajo `bash -e`: con la cabecera presente sale **1**; sin ella sale 0 y el step sigue. Los seis asserts del step, replicados literalmente contra el build de producción, pasan. actionlint en exit 0. **La forma que yo había recomendado (`! grep -qi`) era incorrecta**: comprobé que bajo `bash -e`, al estar exenta de errexit y no ser el último comando del step, el fallo se habría tragado igualmente. La corrección aplicada es mejor que mi recomendación |
| 23 | low — `ux.md` describía `Skeleton`, `FormMessage` y `Alert` ya eliminados | **resuelto** | `ux.md:27` describe ahora `Button` y enlaces `next/link` con `buttonVariants`, y difiere formulario, aviso y carga a la feature que los use; `ux.md:42` reformula "Error identification and recovery" sobre la pantalla de error con `role="alert"` y difiere los mensajes por campo. Queda el residuo de la línea 41, registrado arriba como observación no bloqueante |

## Checklist
Marcado = dimensión efectivamente revisada por el revisor en este repositorio a lo largo de las cuatro pasadas; el
resultado de cada revisión está en Findings y en las tablas de trazabilidad.

- [x] Acceptance criteria implemented and tested — AC-1..AC-8 y AC-10..AC-12 verificados y reproducidos por el revisor, incluidos AC-6 sobre la imagen de producción y con cabeceras de prefetch, y AC-8 con la imagen reconstruida. **AC-9 se cumple solo en parte** (`enforce_admins=false`): riesgo aceptado por el product owner, pendiente de que un humano lo registre como desviación con vencimiento
- [x] Scope limited to plan — los cuatro commits de corrección se limitan a los hallazgos de la revisión y a la documentación asociada; las desviaciones están registradas en `plan.md`. Sin código muerto, restos de depuración ni tests comentados
- [x] Security (input, authn/authz, secrets, dependencias, privilegios) — sin authn/authz en este cambio; headers de seguridad no evitables, ruta de prueba fuera del build de producción, redacción de datos personales a cuatro niveles, dependencias con Trivy en verde, privilegios de base separados y CI sin vías de inyección desde un PR. Sin hallazgos abiertos
- [x] Conforms to accepted ADRs / contracts compatible — `sdlc arch` en verde; `design.md` actualizado y su recibo de `architect` reemitido sobre el contenido nuevo; sin API pública, coherente con `[contracts] files = []`
- [x] Operability (telemetry, flags, rollback) — errores de servidor con 5xx, 404 reales y `health_degraded` en logs, verificados en contenedor; migración inicial idempotente y rollback documentado. Pendiente, fuera del alcance de los hallazgos: las métricas EMF que describe `design.md §Observability`
- [x] Tests meaningful and not flaky — 21 unit, 8 de integración (9 ejecuciones acumuladas sin fallos) y 9 e2e, con aserciones reales sobre estados HTTP, rutas, cabeceras y la lista exacta de claves del log; sin esperas fijas ni dependencias de orden. El único assert vacuo detectado ya se corrigió y se comprobó que ahora falla
- [x] Verification evidence reproducible — todas las afirmaciones de `verification.md`, incluidas las de las tres rondas de corrección, se reprodujeron con resultados idénticos. La única evidencia que no se sostenía (la del assert de `X-Powered-By`) está corregida y verificada

## Not reviewed
- Ejecuciones reales de CI en GitHub para `20d646b` y `8aba8dd`: se revisaron las definiciones de los workflows, se
  pasaron actionlint y zizmor y se replicaron localmente los comandos y los asserts, pero no hay un run posterior a
  estos commits que inspeccionar. El job `container` completo (build de imagen dentro del runner) solo se reprodujo
  por partes: la imagen se reconstruyó y escaneó en la segunda pasada, y los asserts se replicaron en la tercera y la
  cuarta contra el build de producción.
- Evidencia SARIF/CycloneDX de gitleaks, Semgrep, Trivy fs y Syft: se genera en CI y no se commitea. El escaneo de
  imagen se reprodujo en la segunda pasada (exit 0) y el `Dockerfile` no ha cambiado desde entonces.
- Comportamiento de `notFound()` dentro de una página en producción y errores posteriores al primer flush del
  streaming SSR (seguirían respondiendo 200): no hay ruta en este cambio que provoque ninguno de los dos casos.
- `pnpm-lock.yaml`: no ha cambiado desde la primera pasada, donde se verificaron los tres paquetes con override.
- Contenido de `discovery.md`, `data.md` y `cost.md` como artefactos de decisión ya aprobados.
- Infraestructura AWS de ADR-0005: no existe en este cambio, llega en la fase release.
- Revisión manual con lector de pantalla y medición de p95 con 20 usuarios concurrentes: `verification.md` ya las
  declara pendientes y el revisor tampoco las ejecutó. Siguen siendo requisito antes del release.
- `release.md` y `runbook.md` siguen siendo plantillas sin rellenar; corresponden a fases posteriores.
