---
status: proposed
---
# Threat model: plataforma de reservas (base, autenticación, datos, email y despliegue)

## What are we working on?
Diagrama de despliegue: `docs/diagrams/00-deployment.drawio` (render `00-deployment.png`). Decisiones: ADR-0001 a
ADR-0005.

**Actores:** cliente (internet, navegador), personal y administrador (internet, navegador), mantenedor (GitHub, AWS),
atacante externo.

**Procesos:** `web` (Next.js: páginas, route handlers, server actions, Better Auth) en ECS Fargate detrás de un ALB;
`worker` (pg-boss: recordatorios, limpieza, retención); `migrate` (tarea única de Prisma Migrate); pipeline de GitHub
Actions (build, escaneos, push a ECR, despliegue por OIDC).

**Almacenes:** RDS PostgreSQL (usuarios, sesiones, factores, consentimientos, reservas, cola), respaldos RDS, Secrets
Manager (credenciales de base, `BETTER_AUTH_SECRET`), CloudWatch Logs, ECR (imágenes).

**Terceros:** Amazon SES (entrega de email), buzones de los clientes, dependencias npm, GitHub.

**Fronteras de confianza:**
- TB1 Internet → ALB (TLS) → `web`.
- TB2 `web`/`worker`/`migrate` → RDS (subred privada, TLS).
- TB3 `web`/`worker` → SES (API AWS con rol IAM) → buzón del cliente (internet, fuera de control).
- TB4 GitHub Actions → AWS (OIDC) → ECR/ECS.
- TB5 Dependencias npm e imágenes base → build.
- TB6 Rol cliente ↔ rol personal dentro de la app (autorización).

No hay LLMs ni agentes en el producto; las listas OWASP para LLM y agentes no aplican al producto. Sí aplica a la
cadena de desarrollo (agente de IA con acceso al repo): cubierto por T-17.

## What can go wrong?
| ID | Element / boundary | STRIDE / OWASP category | Threat | Likelihood | Impact |
|---|---|---|---|---|---|
| T-1 | TB1 enlace mágico | Spoofing / A07 Identification and Authentication Failures | Robo o reutilización del enlace mágico (reenvío de email, historial, logs de proxy, prefetch de escáneres de email que consumen el token) | Media | Alta |
| T-2 | TB1 solicitud de enlace | Information disclosure / A07 | Enumeración de clientes registrados por diferencias de respuesta o tiempo | Media | Media |
| T-3 | TB1 solicitud de enlace | Denial of service / abuso | Bombardeo de emails a una víctima o agotamiento de cuota y reputación de SES | Media | Alta |
| T-4 | TB6 panel del personal | Elevation of privilege / A01 Broken Access Control | Ruta, route handler o server action del panel sin verificación de rol o de segundo factor (el plugin `twoFactor` no exige 2FA en enlace mágico) | Media | Alta |
| T-5 | TB6 reservas | Elevation of privilege / A01 (IDOR) | Cliente consulta, modifica o cancela reservas de otro cliente cambiando IDs | Media | Alta |
| T-6 | Cuenta de personal | Spoofing | Toma de control del email del personal para entrar al panel | Baja | Alta |
| T-7 | TB1 formularios y server actions | Tampering / A01 CSRF, A03 Injection | CSRF en server actions; inyección SQL en consultas crudas; XSS en nombres de clientes o servicios mostrados al personal | Media | Alta |
| T-8 | TB1 sesiones | Spoofing / session hijacking | Robo de cookie de sesión (XSS, red no cifrada) | Baja | Alta |
| T-9 | Reservas concurrentes | Tampering (integridad) | Doble reserva del mismo recurso y hora por carrera entre peticiones | Media | Media |
| T-10 | TB3 emails | Information disclosure | Email de recordatorio expone datos de salud (servicio) a quien lea el buzón o al proveedor | Media | Alta |
| T-11 | TB3 dominio remitente | Spoofing | Phishing suplantando al negocio con su dominio | Media | Media |
| T-12 | Logs | Information disclosure / A09 | Datos personales, tokens o cookies en logs de aplicación o de errores | Media | Media |
| T-13 | TB2 RDS y respaldos | Information disclosure | Acceso a la base o a snapshots por red expuesta, credenciales filtradas o snapshot compartido | Baja | Alta |
| T-14 | Secretos | Information disclosure / A02 | `BETTER_AUTH_SECRET` o credenciales de base en el repo, imagen o variables visibles en CI | Baja | Alta |
| T-15 | TB5 dependencias e imagen | Tampering / A06 Vulnerable and Outdated Components, A08 | Dependencia comprometida o con CVE crítica; imagen base vulnerable | Media | Alta |
| T-16 | TB4 CI/CD | Elevation of privilege / A08 Software and Data Integrity Failures | Workflow modificado en un PR que despliega o roba credenciales; claves AWS de larga duración | Baja | Alta |
| T-17 | Cadena de desarrollo con agente de IA | Tampering | Instrucciones inyectadas en contenido externo (issues, páginas, dependencias) que llevan al agente a debilitar controles | Baja | Media |
| T-18 | Acciones del personal | Repudiation | Personal cancela o modifica reservas y niega haberlo hecho | Media | Media |
| T-19 | TB1 `web` | Denial of service | Inundación de peticiones que agota la única tarea `web` (0,5 vCPU) | Baja | Media |
| T-20 | Datos personales | Information disclosure (cumplimiento) | Datos retenidos más allá de lo necesario o supresión incompleta (incluye respaldos) | Media | Media |

## What are we going to do about it?
| Threat | Control | Verifiable by | Owner |
|---|---|---|---|
| T-1 | Token de un solo uso con hash en base, expira en 10 min; el enlace abre una página que requiere un clic de confirmación (POST) antes de consumir el token, para que el prefetch de escáneres no lo gaste; `Referrer-Policy: no-referrer` en esa ruta; query string excluida de logs | Tests de integración: token reutilizado → rechazado; token a los 11 min → rechazado; GET no consume token. e2e del flujo | tech-lead |
| T-2 | Respuesta y código HTTP idénticos exista o no la cuenta; envío de email en segundo plano para igualar tiempos | Test de integración que compara cuerpo, estado y tiempo (diferencia p95 < 50 ms) para email existente e inexistente | security |
| T-3 | Rate limit ≤ 5 solicitudes por IP / 10 min y ≤ 3 por email / 15 min (almacenamiento en base); alarma de SES por tasa de rebote > 5 % y quejas > 0,1 % | Tests de integración del rate limit (sexta solicitud → 429); alarma definida en IaC | security |
| T-4 | Guard único `requireStaff()` (rol + `secondFactorVerifiedAt` + edad de sesión ≤ 8 h) llamado en cada página, route handler y server action bajo `src/app/(staff)/`; test estático que falla si un archivo de esa carpeta no lo invoca; `proxy.ts` solo como defensa adicional | Test de arquitectura en Vitest; e2e que recorre todas las rutas del panel con (a) sin sesión, (b) sesión de cliente, (c) personal sin segundo factor → 403/redirección | security |
| T-5 | Todas las consultas de reservas del cliente filtran por `userId` de la sesión en la capa `server`; nunca se confía en un `userId` recibido del cliente | Tests de integración IDOR: cliente A intenta leer, cancelar y modificar reserva de B → 404 | tech-lead |
| T-6 | Segundo factor obligatorio para personal (passkey o TOTP), códigos de respaldo de un solo uso, bloqueo tras 5 intentos fallidos; revocación de sesiones al desactivar miembro | e2e de enrolamiento y verificación; test de bloqueo; test de revocación | security |
| T-7 | Server actions de Next.js con verificación de origen (Origin/Host) y cookies `SameSite=Lax`; Prisma con consultas parametrizadas, SQL crudo solo con `$queryRaw` etiquetado (lint que prohíbe `$queryRawUnsafe`); React escapa por defecto, lint prohíbe `dangerouslySetInnerHTML`; CSP con nonce sin `unsafe-inline` para scripts | Regla ESLint en CI; test e2e de headers CSP (AC-6); test de integración con payload XSS en nombre de cliente renderizado en el panel | tech-lead |
| T-8 | Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, prefijo `__Secure-`; HSTS en producción; TLS 1.2+ en ALB (política `ELBSecurityPolicy-TLS13-1-2-2021-06`) | Test e2e de atributos de cookie; IaC revisado con Checkov | security |
| T-9 | Restricción `EXCLUDE USING gist` en `Booking` (ADR-0003) además de validación en dominio | Test de integración concurrente: 2 reservas simultáneas → exactamente 1 confirmada | tech-lead |
| T-10 | Plantillas de email sin servicio, profesional ni notas; solo negocio, fecha, hora y enlace que requiere sesión (ADR-0004) | Test unitario de plantillas: el HTML y el texto renderizados no contienen el nombre del servicio ni del recurso de la reserva de prueba | product-owner |
| T-11 | SPF, DKIM (Easy DKIM) y DMARC `p=quarantine` en el dominio remitente; emails nunca piden credenciales ni pagos | Verificación DNS en checklist de release (`release.md`) con salida de `dig` | sre |
| T-12 | Logger estructurado con lista de campos permitidos (sin cuerpo, cookies, headers de autorización, query string, emails); errores con `requestId`, sin stack traces al cliente | Test unitario del logger (AC-10); test de integración de error 500 sin stack en la respuesta (AC-4) | tech-lead |
| T-13 | RDS en subredes privadas sin IP pública, security group solo desde `web`/`worker`/`migrate`; cifrado KMS en reposo y en snapshots; `rds.force_ssl=1`; protección contra borrado; usuarios `app` (DML) y `migrator` (DDL) separados; snapshots nunca públicos | Checkov sobre IaC en CI; verificación de parámetros RDS en `verification.md` del release | sre |
| T-14 | Secretos solo en Secrets Manager, inyectados por ECS; validación de configuración sin imprimir valores (AC-5); escaneo de secretos (gitleaks) en pre-commit y CI; `.env*` en `.gitignore` salvo `.env.example` sin valores | Evidencia SARIF `secrets` requerida por el perfil; test unitario de AC-5 | security |
| T-15 | Lockfile con `--frozen-lockfile`; Dependabot; SCA con umbral `high` (`fail_on`); SBOM CycloneDX; imagen base `node:24` slim fijada por digest; escaneo de imagen en ECR y en CI (Trivy); pnpm con `onlyBuiltDependencies` explícito | Evidencias `sca`, `sbom` y escaneo de contenedor; `sdlc evidence check` | platform |
| T-16 | OIDC de GitHub con rol AWS restringido a `repo:huanrasan/demo-webapp:ref:refs/heads/main` y environment `production` con aprobación; workflows sin `pull_request_target`; acciones de terceros fijadas por SHA; permisos mínimos `permissions:` por job; CODEOWNERS en `.github/workflows/` | Revisión del workflow en `review.md`; linter de workflows (zizmor o actionlint) en CI | platform |
| T-17 | Reglas de `AGENTS.md` (contenido externo como datos, prohibición de debilitar tests o hooks); sensor `weakened_tests = error`; revisión humana obligatoria con CODEOWNERS | `sdlc check --base` en CI; aprobación de PR | tech-lead |
| T-18 | Registro de auditoría append-only en base (`AuditEvent`: actor, acción, entidad, fecha) para creación, cancelación y cambios de reservas hechos por personal; sin datos personales en el evento más allá de IDs | Test de integración: cancelación por personal genera evento con actor correcto | tech-lead |
| T-19 | Rate limiting por IP en rutas de autenticación; escalado de `web` a 2 tareas por CPU > 60 %; AWS Shield Standard (incluido con ALB); WAF evaluado si hay incidente (fuera del costo base) | Política de escalado en IaC; alarma de 5xx del ALB | sre |
| T-20 | Tareas de retención y anonimización (data.md) con logs de ejecución; supresión inmediata a solicitud; respaldos expiran a 35 días | Tests de integración de anonimización (sin nombre/email/teléfono tras ejecutar); métrica de última ejecución exitosa con alarma si > 35 días | data-steward |

Los controles verificables por test se trasladan a `plan.md` (tests de este cambio) o al `plan.md` de la feature que
los implementa (T-1 a T-6, T-9, T-10, T-18, T-20). Este cambio implementa y prueba: T-7 (lint, CSP), T-8 (headers),
T-12, T-14, T-15, T-16, T-17 y la parte de imagen de T-13.

## Did we do a good enough job?
Riesgos residuales:
- **Guard de segundo factor propio (T-4):** depende de disciplina y de un test estático; un patrón de ruta nuevo fuera
  de `src/app/(staff)/` podría escapar. Revisar el test al añadir rutas del panel.
- **RDS Single-AZ y una tarea `web` (T-19 y disponibilidad):** una caída de AZ implica restauración (RTO 4 h).
- **Buzón del cliente (T-1, T-10):** fuera de control; la seguridad de la cuenta del cliente equivale a la de su email.
- **Tareas con IP pública:** sin puertos entrantes salvo desde el ALB; aceptado por costo frente a NAT Gateway.
- **Sin WAF en el piloto:** aceptado por costo; revisar tras el primer incidente de abuso.
- **Interpretación legal no validada:** bloquea release hasta revisión.

Aceptación de riesgos residuales: pendiente del rol `security` (huanrasan) con `sdlc approve`.
Revisar el modelo: en cada feature que añada una frontera o un flujo de datos nuevo, tras cualquier incidente de
seguridad y como máximo a los 6 meses.
