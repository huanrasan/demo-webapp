# 0004. Enviar email con Amazon SES tras una interfaz propia y ejecutar tareas programadas con pg-boss en un worker

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** huanrasan (architect)
**Advice from:** Agente IA (propuesta inicial). Pendiente: security, platform
**Supersedes:** -

## Context and problem
La app envía enlaces mágicos (críticos: sin ellos nadie inicia sesión), confirmaciones, cancelaciones y recordatorios
programados. Decisiones de producto: proveedor de la nube elegida (AWS SES); emails sin el nombre del servicio. La
plataforma de contenedores genérica no garantiza cron. Volumen estimado ≤ 30.000 emails/mes.

Momento de decidir: antes de la feature de registro (enlace mágico) y de recordatorios.

## Decision drivers
| Criterio | Peso |
|---|---|
| Fiabilidad: un recordatorio se envía una sola vez y sobrevive a reinicios y despliegues | 5 |
| Portabilidad: cambiar de proveedor de email o de nube sin tocar casos de uso | 4 |
| Simplicidad operativa (sin nuevos servicios que operar) | 4 |
| Costo | 3 |

## Options considered
**Email**
1. Interfaz `EmailSender` en `src/server/email` con adaptador SES (API SESv2, credenciales del rol IAM de la tarea) y
   adaptador SMTP para desarrollo (Mailpit en Docker Compose).
2. Llamar al SDK de SES directamente desde los casos de uso.

**Tareas programadas**
1. **pg-boss** sobre la misma PostgreSQL, consumido por un proceso worker separado (misma imagen, otro comando).
2. **EventBridge Scheduler + SQS + Lambda** (gestionado por AWS).
3. **Cron de la plataforma** que invoca un endpoint HTTP protegido cada minuto.
4. Do nothing: temporizadores en memoria del proceso web (se pierden al reiniciar).

## Trade-off analysis
| Criterion (weight) | pg-boss + worker | EventBridge + SQS + Lambda | Cron → endpoint | En memoria |
|---|---|---|---|---|
| Fiabilidad (5) | 5: transaccional con la reserva, reintentos, `singletonKey` | 4: consistencia eventual entre base y cola | 3: depende del cron; reintentos propios | 1 |
| Portabilidad (4) | 5: solo PostgreSQL | 1: lock-in AWS | 3: cada plataforma define su cron | 5 |
| Simplicidad (4) | 4: un proceso más | 2: tres servicios, IAM, empaquetado Lambda | 3 | 5 |
| Costo (3) | 5: sin servicio adicional | 4 | 5 | 5 |
| **Total ponderado** | **76** | **44** | **54** | **60** |

Para email, la opción 1 (interfaz + adaptadores) gana en portabilidad y testabilidad con costo marginal.

## Decision
- **Email:** interfaz `EmailSender` con adaptadores `ses` (producción) y `smtp` (local, Mailpit). Selección por
  `EMAIL_TRANSPORT`. Remitente en un dominio propio con SPF, DKIM (Easy DKIM) y DMARC `p=quarantine` antes del piloto;
  salida del sandbox de SES como requisito de release. Rebotes y quejas por SNS → endpoint firmado que marca el email
  como no entregable (se implementa con la feature de recordatorios).
- **Contenido:** ningún email incluye nombre del servicio, profesional ni datos de salud; solo negocio, fecha, hora y
  enlace que requiere sesión. Plantillas en español.
- **Tareas:** pg-boss en el esquema `pgboss`. La reserva y su trabajo de recordatorio se crean en la misma transacción
  (patrón outbox usando la cola en PostgreSQL). Recordatorio con `startAfter` = inicio − 24 h y `singletonKey` =
  `reminder:<bookingId>`; al cancelar se cancela el trabajo. El worker vuelve a leer la reserva antes de enviar y
  descarta si ya no está confirmada. Reintentos: 5 con backoff exponencial; fallos finales a cola `dead-letter` con alarma.
- **Enlace mágico:** se envía en línea desde la petición (latencia percibida) con reintento corto; si SES falla, el
  usuario ve un error recuperable y se registra una métrica.
- **Worker:** proceso `node dist/worker.js` desde la misma imagen; apagado ordenado (`SIGTERM` → `boss.stop()` con
  espera de trabajos en curso ≤ 30 s).

## Advice received
Ninguna externa todavía. Aceptado por huanrasan (architect) el 2026-09-17; el recibo `sdlc approve` y la revisión del PR lo formalizan.

## Consequences
- Positive: sin servicios nuevos que operar; recordatorios consistentes con el estado de la reserva; cambiar SES por
  otro proveedor es un adaptador.
- Negative / accepted trade-offs: la cola comparte recursos con la base transaccional (aceptable al volumen del piloto);
  un proceso worker adicional con su costo; SES exige trámite de salida del sandbox.
- Follow-up actions: métricas de cola (pendientes, fallidos, antigüedad del más viejo) y alarmas (ADR-0005, `design.md`).

## Revisit triggers
- Más de 50.000 trabajos/día o latencia de la base afectada por la cola.
- Tasa de rebote > 5 % o quejas > 0,1 % sostenidas (riesgo de suspensión de SES).
- Necesidad de canales adicionales (SMS/WhatsApp).
