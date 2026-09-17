# 0002. Autenticar con Better Auth: enlace mágico para todos y segundo factor obligatorio para el personal

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** huanrasan (architect)
**Advice from:** Agente IA (propuesta inicial). Pendiente: security
**Supersedes:** -

## Context and problem
Decisiones de producto (`spec.md`): clientes inician sesión con enlace mágico por email; el personal usa enlace mágico
más passkey o TOTP obligatorios porque accede a datos de todos los clientes. Solo mayores de 18 años. Colombia,
Ley 1581: la autorización del titular debe quedar probada.

`AGENTS.md` declara Auth.js. Desde septiembre de 2025 Auth.js es mantenido por el equipo de Better Auth, que recomienda
Better Auth para proyectos nuevos y mantiene Auth.js con parches de seguridad
([anuncio](https://better-auth.com/blog/authjs-joins-better-auth)). Auth.js no incluye TOTP ni una capa de segundo
factor, que habría que construir a mano.

Momento de decidir: antes de la feature de registro e inicio de sesión; condiciona el esquema de datos inicial.

## Decision drivers
| Criterio | Peso |
|---|---|
| Seguridad: soporte mantenido de enlace mágico, TOTP, passkeys, sesiones revocables, rate limiting | 5 |
| Menos código de seguridad propio | 4 |
| Datos en nuestra PostgreSQL (sin identidad en un tercero) | 4 |
| Madurez y continuidad del proyecto | 3 |
| Coherencia con `AGENTS.md` | 2 |

## Options considered
1. **Better Auth** con Prisma adapter, sesiones en base de datos, plugins `magicLink`, `twoFactor` (TOTP + códigos de
   respaldo) y `@better-auth/passkey`.
2. **Auth.js v5** con Email provider y sesiones en base de datos; TOTP y passkey como segundo factor implementados a
   mano (otplib + SimpleWebAuthn).
3. **Amazon Cognito** (IdP gestionado): enlace mágico y MFA gestionados por AWS.
4. Do nothing / defer: bloquea la feature de registro.

## Trade-off analysis
| Criterion (weight) | Better Auth | Auth.js + 2FA propio | Cognito | Do nothing |
|---|---|---|---|---|
| Seguridad mantenida (5) | 4: plugins mantenidos; el 2FA no se exige solo en enlace mágico (ver Decisión) | 2: 2FA propio sin respaldo de la librería | 4 | 0 |
| Menos código de seguridad propio (4) | 4 | 2 | 5 | 0 |
| Datos en nuestra base (4) | 5 | 5 | 1: identidades en AWS Cognito, lock-in | 0 |
| Madurez y continuidad (3) | 3: más joven, pero es la línea recomendada | 3: solo mantenimiento | 5 | 0 |
| Coherencia con AGENTS.md (2) | 1: requiere actualizar AGENTS.md | 5 | 1 | 5 |
| **Total ponderado** | **67** | **57** | **61** | **10** |

## Decision
Opción 1, Better Auth, con esta configuración:

- **Enlace mágico:** token de un solo uso guardado con hash (`storeToken: "hashed"`), expira en 10 minutos. Los
  clientes se registran solos; la cuenta de personal nunca se crea por enlace mágico (alta solo por invitación de un
  administrador o por el comando de arranque del primer administrador).
- **Sesiones en base de datos** (revocables). Clientes: expiran a los 30 días, renovación diaria. Personal: además de la
  expiración global, el guard de servidor rechaza sesiones con más de 8 h desde su creación.
- **Segundo factor del personal:** passkey (WebAuthn) o TOTP con códigos de respaldo. La documentación de Better Auth
  indica que el plugin `twoFactor` no exige el segundo factor en inicios de sesión por enlace mágico. Por eso la
  aplicación lo exige por sí misma: la sesión de un usuario con rol `staff` o `admin` guarda `secondFactorVerifiedAt`,
  y un guard único `requireStaff()` en `src/server/auth` lo verifica en cada página, route handler y server action del
  panel (no solo en `proxy.ts`). Sin segundo factor verificado solo se accede a la pantalla de verificación o enrolamiento.
- **Rate limiting** con almacenamiento en base de datos: solicitud de enlace mágico ≤ 5 por IP cada 10 min y ≤ 3 por
  email cada 15 min; verificación de TOTP bloqueada tras 5 intentos fallidos consecutivos.
- **Respuesta uniforme** al pedir un enlace mágico (misma respuesta exista o no la cuenta) para no revelar clientes.
- **Registro:** declaración de mayoría de edad y aceptación de la política de tratamiento (versión, fecha y hora)
  obligatorias antes de crear la cuenta.
- Actualizar `AGENTS.md` (stack) al implementar, reemplazando Auth.js por Better Auth.

## Advice received
Ninguna externa todavía. Decisión del product owner el 2026-09-17: aceptar Better Auth en lugar de Auth.js. Aceptado por huanrasan (architect) el 2026-09-17; el recibo `sdlc approve` y la revisión del PR lo formalizan. Pregunta específica para security: ¿el guard de segundo factor implementado en la app es
aceptable, o se exige una prueba e2e por cada ruta del panel?

## Consequences
- Positive: TOTP, passkeys, códigos de respaldo y rate limiting mantenidos por la librería; identidades en nuestra base;
  sesiones revocables al desactivar a un miembro del personal.
- Negative / accepted trade-offs: el segundo factor con enlace mágico depende de un guard propio (riesgo de olvidarlo en
  una ruta nueva); librería más joven que Auth.js; divergencia con el stack original de `AGENTS.md`.
- Follow-up actions: test de arquitectura que falle si una ruta bajo `src/app/(staff)/` no llama a `requireStaff()`;
  e2e que intente acceder a cada ruta del panel con sesión sin segundo factor; SPF/DKIM/DMARC antes del piloto (ADR-0004).

## Revisit triggers
- Vulnerabilidad crítica en Better Auth sin parche en 14 días.
- Better Auth incorpora exigencia nativa de segundo factor en enlace mágico (reemplazar el guard propio).
- Pedido de SSO corporativo para el personal (SAML/OIDC).
