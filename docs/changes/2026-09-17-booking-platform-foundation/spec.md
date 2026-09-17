---
status: proposed
---
# Spec: base de la plataforma de reservas

## Problem and outcome
El producto de reservas (ver `discovery.md`, decisión `go`) no tiene aplicación, base de datos, pipeline ni decisiones
técnicas registradas. Sin esa base, cada cambio `feature` posterior (registro e inicio de sesión, disponibilidad y
reserva, cancelación, recordatorios, panel del personal) tendría que decidir stack, seguridad y despliegue por su cuenta.

Resultado medible: un repositorio que se clona, instala, prueba, construye y despliega como contenedor con un único
flujo documentado; CI bloquea los PR que rompen build, tests, lint, formato o gates de seguridad; y las decisiones de
arquitectura (autenticación, datos, email, despliegue) quedan en ADRs aceptados sobre los que construyen las features.

Issue: no hay issue enlazado todavía.

## Acceptance criteria
| ID | Given / When / Then | Verified by |
|---|---|---|
| AC-1 | Given un clon limpio con Node LTS y pnpm, when se ejecuta `pnpm install --frozen-lockfile && pnpm build`, then termina con código 0 | Job de CI `build` |
| AC-2 | Given PostgreSQL vacío levantado con `docker compose up -d db`, when se ejecuta `pnpm db:migrate`, then todas las migraciones se aplican con código 0, y al repetirlo no hay cambios pendientes | Job de CI `migrate` contra un servicio PostgreSQL |
| AC-3 | Given la app corriendo con la base de datos accesible, when se hace `GET /api/health`, then responde 200 con `{"status":"ok","db":"ok"}` en menos de 500 ms | Test de integración (Vitest) |
| AC-4 | Given la app corriendo con la base de datos inaccesible, when se hace `GET /api/health`, then responde 503 con `{"status":"degraded","db":"unreachable"}` sin exponer detalles de conexión ni stack traces | Test de integración (Vitest) |
| AC-5 | Given falta una variable de entorno obligatoria o tiene formato inválido (p. ej. `BUSINESS_TIMEZONE` que no es IANA), when la app arranca, then termina con código distinto de 0 y un mensaje que nombra la variable sin imprimir su valor | Test unitario del módulo de configuración |
| AC-6 | Given cualquier página HTML, when se solicita, then la respuesta incluye `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `frame-ancestors 'none'`, y `Strict-Transport-Security` en producción | Test e2e (Playwright) que inspecciona headers |
| AC-7 | Given la página de inicio, when se renderiza, then tiene `lang="es"`, textos en español y cero violaciones axe-core de impacto `serious` o `critical` | Test e2e (Playwright + axe-core) |
| AC-8 | Given la imagen de contenedor construida desde el `Dockerfile` del repo, when se ejecuta con variables válidas, then el proceso corre como usuario no root y `GET /api/health` responde 200 | Job de CI `container` (build + run + curl) |
| AC-9 | Given un PR contra `main`, when corre CI, then ejecuta `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`, `sdlc check` y los escaneos de secretos, SAST, SCA y SBOM, y el PR queda bloqueado si alguno falla | Configuración de workflows + un PR de prueba con un fallo intencional, revertido |
| AC-10 | Given una petición que falla con error del servidor, when se registra en logs, then la entrada es JSON con `level`, `timestamp` (UTC ISO-8601), `requestId` y ruta sin query string, y no contiene cuerpo, cookies, headers de autorización ni emails | Test unitario del logger con una petición que incluye un email |
| AC-11 | Given un instante guardado en la base de datos, when se muestra en la interfaz, then se almacenó en UTC y se presenta en la zona `BUSINESS_TIMEZONE` con formato `es` | Test unitario de la utilidad de fechas, incluido un cambio de horario de verano en una zona de prueba que lo tenga |
| AC-12 | Given el cambio listo para review, when se revisa `docs/adr/`, then existen ADRs aceptados para: stack y runtime, autenticación con enlace mágico, modelo single-tenant y acceso a datos, envío de email y tareas programadas, y despliegue en contenedor | `sdlc check` + aprobación del rol `architect` |

## Non-functional requirements
| Concern | Requirement (with numbers) |
|---|---|
| Performance | p95 < 500 ms en páginas y rutas API del servidor con 20 usuarios concurrentes; `GET /api/health` < 500 ms. Dimensionado para hasta 10 personas de personal, 2.000 clientes y 200 reservas al día |
| Availability / resilience | 99,5 % mensual (≈ 3 h 39 min de caída admisible). RPO ≤ 24 h con respaldo diario de PostgreSQL; RTO ≤ 4 h con procedimiento de restauración probado una vez antes del lanzamiento |
| Security and data classification | Datos personales de clientes (nombre, email, teléfono) = `confidential`. TLS 1.2+ en tránsito; cifrado en reposo del almacenamiento de la base de datos y respaldos. Secretos solo por variables de entorno inyectadas desde un secret manager, nunca en el repo. Dependencias sin vulnerabilidades `high`/`critical` (umbral `fail_on = high`). Controles OWASP ASVS nivel 2 para autenticación y sesiones en la feature de login |
| Compliance / residency / retention | Colombia: Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015). (1) Autorización previa, expresa e informada del titular al registrarse, con prueba conservada (versión de la política, fecha y hora); (2) política de tratamiento de información publicada y aviso de privacidad; (3) consultas del titular atendidas en ≤ 10 días hábiles y reclamos (rectificación, supresión, revocatoria) en ≤ 15 días hábiles, prórrogas legales aparte; (4) sin datos sensibles (art. 5, incluye salud); (5) transmisión a encargados (nube, email) mediante contrato de transmisión, también si están fuera de Colombia; sin requisito legal de residencia local. Retención propuesta (principio de temporalidad): cuentas inactivas por 24 meses se anonimizan; reservas pasadas se conservan 24 meses; logs 30 días; respaldos 35 días. Requiere validación de un asesor legal antes de release |
| Deployment target (public, private, on-prem, hybrid) | Cualquier plataforma de contenedores en nube pública o privada; un negocio por instalación. Sin servicios propietarios de un proveedor en el código de la app: PostgreSQL estándar y email por un proveedor intercambiable. Desarrollo local con Docker Compose |
| Cost | Producción del piloto ≤ USD 90/mes (app + PostgreSQL gestionado + respaldos + email + observabilidad). Se detalla en `cost.md` |
| Accessibility | WCAG 2.2 AA en todas las pantallas; verificación automática axe-core en e2e más revisión manual con teclado por feature |
| Localization | Interfaz y emails solo en español; una zona horaria IANA por instalación (`BUSINESS_TIMEZONE`); instantes en UTC en la base de datos |

## Out of scope
- Implementar registro, inicio de sesión, disponibilidad, reservas, cancelación, recordatorios y panel del personal:
  cada uno es un cambio `feature` separado. Este cambio solo decide su arquitectura en ADRs y deja la base lista.
- Multi-tenant, pagos, SMS/WhatsApp, apps móviles nativas, calendarios externos, multi-idioma, zona horaria por cliente.
- Datos clínicos de cualquier tipo (motivo de consulta, notas, diagnósticos).
- Clientes menores de edad y autorización de representantes legales.
- Aprovisionamiento de infraestructura productiva (IaC) y despliegue a producción: se decide la topología en el ADR
  de despliegue; la ejecución llega con la fase release.

## Decisions and clarifications
| Question | Answer | Who |
|---|---|---|
| ¿Una arquitectura base y luego una feature por capacidad? | Sí | huanrasan (product owner) |
| ¿Un negocio por instalación o multi-tenant? | Un negocio por instalación | huanrasan (product owner) |
| ¿Datos que guarda una reserva? | Mínimos: nombre, email, teléfono, servicio y horario; sin motivo ni notas | huanrasan (product owner) |
| ¿Método de inicio de sesión del cliente? | Enlace mágico por email | huanrasan (product owner) |
| ¿Jurisdicción de protección de datos? | Colombia (Ley 1581 de 2012) | huanrasan (product owner) |
| ¿Se aceptan clientes menores de edad? | No: solo mayores de 18 años; el registro exige declarar la mayoría de edad (se implementa en la feature de registro) | huanrasan (product owner) |
| ¿Idioma y zona horaria? | Español; una zona horaria por negocio | huanrasan (product owner) |
| ¿Escala y disponibilidad del piloto? | Pequeña: ≤ 10 personas de personal, ≤ 2.000 clientes, ≤ 200 reservas/día, 99,5 % | huanrasan (product owner) |
| ¿Tope de costo mensual de producción? | ≤ USD 90/mes (enmienda del 2026-09-17: el estimado del diseño con servicios gestionados es ≈ USD 77,40; el tope original de USD 50 no era alcanzable con balanceador gestionado) | huanrasan (product owner) |
| ¿Stack? | Next.js (App Router, TypeScript), PostgreSQL + Prisma, Better Auth (reemplaza Auth.js, ADR-0002, aceptado por huanrasan el 2026-09-17), Vitest, Playwright | Repositorio |

## Risks and open questions
- **Registro Nacional de Bases de Datos (RNBD).** La inscripción ante la SIC es obligatoria solo para sociedades y
  entidades con activos totales superiores a 100.000 UVT (Decreto 090 de 2018); cada negocio que instale la app debe
  verificar si le aplica. Es obligación del negocio (responsable del tratamiento), no de la app.
- **Nombres de servicio que revelan salud.** En consultorios, un servicio como "psicología" o "control prenatal"
  asociado a una persona puede considerarse dato sensible aunque no haya notas clínicas. A tratar en `data.md` y en el
  modelo de amenazas (clasificación, acceso restringido del personal, contenido de los emails).
- **Menores de edad.** El registro se limita a mayores de 18 años mediante declaración del cliente, sin verificación
  documental. Riesgo residual: un menor que declare falsamente su edad. Los negocios con clientes menores deben
  gestionar esas reservas fuera de la app (p. ej. las registra el personal a nombre del representante legal).
- **Validación legal.** Los requisitos de Ley 1581 de este spec son una interpretación técnica, no asesoría legal;
  deben validarse con un asesor antes de la fase release.
- **Entregabilidad del email.** El enlace mágico y los recordatorios dependen de que el email llegue a tiempo; un
  proveedor sin SPF/DKIM/DMARC configurados bloquea el inicio de sesión. Mitigación a definir en el ADR de email.
- **Sin evidencia del problema** (ver `discovery.md`). El piloto valida los supuestos; la base debe ser barata de ajustar.
- **Aprobación de PR por el mismo autor.** GitHub no permite que el autor apruebe su propio PR; con un único
  mantenedor, falta confirmar cómo se satisface el paso `approvals verify` de CI.
- **Tareas programadas en single-tenant.** Los recordatorios necesitan un planificador; en una plataforma de
  contenedores genérica no hay cron garantizado. Se decide en el ADR de email y tareas programadas.
