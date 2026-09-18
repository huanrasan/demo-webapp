# Runbook: plataforma de reservas

## Purpose and ownership
Aplicación de reservas de un negocio (single-tenant). Dos procesos desde la imagen `runner`: `web` (Next.js, sirve
clientes y panel) y `worker` (pg-boss, tareas programadas); la imagen `migrator` aplica migraciones antes de cada
despliegue. Datos en RDS PostgreSQL; email por Amazon SES.

- Responsable y escalamiento: huanrasan (único mantenedor; roles `sre`, `tech-lead` y `security` en `.harness/roster.toml`).
- Horario de servicio: horario comercial del negocio; fuera de él la degradación se atiende al siguiente día hábil.
- Objetivo de servicio: 99,5 % mensual, p95 < 500 ms, RPO ≤ 24 h, RTO ≤ 4 h (`spec.md`).

## Dependencies
| Dependencia | Efecto si falla |
|---|---|
| RDS PostgreSQL | La app responde 503 en `/api/health`; no hay reservas ni panel. Sin réplica: recuperación por reinicio o restauración a un punto en el tiempo |
| Amazon SES | No salen enlaces de acceso ni recordatorios; los clientes no pueden iniciar sesión |
| ALB y Route 53 | El sitio deja de ser accesible aunque las tareas estén sanas |
| ECR | Impide desplegar o relanzar tareas; las que ya corren siguen |
| Secrets Manager | Las tareas nuevas no arrancan (la configuración se valida al inicio y el proceso termina) |
| GitHub Actions | Bloquea despliegues, no el servicio |

## Dashboards and alerts
Métricas en CloudWatch (ECS, ALB, RDS, SES) y eventos JSON de la aplicación en CloudWatch Logs.

| Alert | Meaning | First action |
|---|---|---|
| `ALB 5xx > 1 %` durante 5 min | Errores del servidor llegando a los clientes | Ver logs con `event=server_error` y el `digest` que muestra la pantalla de error; si empezó tras un despliegue, revertir a la definición de tarea anterior |
| `ALB p95 > 1 s` durante 10 min | Latencia fuera de objetivo | Revisar CPU de ECS y conexiones de RDS; escalar `web` a 2 tareas |
| `ECS RunningTaskCount web < 1` | No hay quien sirva tráfico | Revisar eventos del servicio ECS; causa habitual: configuración inválida (la tarea sale con código 1 nombrando la variable) |
| `RDS almacenamiento libre < 20 %` | Riesgo de quedarse sin espacio | Ampliar almacenamiento; revisar retención de la cola y de datos (`data.md`) |
| `queue.heartbeat.age > 5 min` | El worker no procesa: recordatorios en riesgo | Revisar logs del servicio `worker`; reiniciarlo. Los trabajos pendientes se retoman solos |
| `SES tasa de rebote > 5 %` | Reputación de envío en riesgo, posible suspensión | Pausar envíos masivos, revisar rebotes y limpiar direcciones no entregables |

## Diagnostics
```bash
# Salud de la aplicación (sin autenticación; no expone detalles)
curl -fsS https://<dominio>/api/health        # 200 {"status":"ok","db":"ok"} | 503 degradado

# Errores del servidor con su código de referencia
aws logs filter-log-events --log-group-name /ecs/booking-web \
  --filter-pattern '{ $.event = "server_error" }' --max-items 20

# Degradación de base de datos vista por la app
aws logs filter-log-events --log-group-name /ecs/booking-web \
  --filter-pattern '{ $.event = "health_degraded" }' --max-items 20

# Estado del worker y de la cola
aws logs filter-log-events --log-group-name /ecs/booking-worker \
  --filter-pattern '{ $.event = "worker_heartbeat" }' --max-items 5
psql "$DATABASE_URL" -c "select name, state, count(*) from pgboss.job group by 1,2 order by 3 desc limit 10;"

# Estado del servicio y del último despliegue
aws ecs describe-services --cluster booking --services web worker \
  --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount,deploy:deployments[0].rolloutState}'
```

Los logs nunca contienen datos personales: se identifican las peticiones por `requestId` y los errores por `digest`.
Para investigar un caso concreto de un cliente hay que pedirle el código de referencia que muestra la pantalla de error.

## Safe mitigations
| Situación | Acción |
|---|---|
| Despliegue defectuoso | `aws ecs update-service --cluster booking --service web --task-definition <revisión anterior>`; el circuit breaker ya revierte solo si el despliegue no se estabiliza |
| Sobrecarga | Escalar `web` a 2 tareas (`--desired-count 2`); el ALB reparte entre AZ |
| Worker atascado | Reiniciar el servicio `worker`; los trabajos son idempotentes y se retoman. Si un trabajo falla en bucle, moverlo a la cola de fallidos y revisar sus logs |
| Base de datos caída | Reiniciar la instancia RDS; si no recupera, restaurar a un punto en el tiempo en otra instancia y apuntar `DATABASE_URL` al endpoint nuevo (RTO objetivo 4 h) |
| SES bloqueado o con mala reputación | Cambiar `EMAIL_TRANSPORT` a un servidor SMTP alternativo (la aplicación lo admite sin cambios de código) mientras se resuelve |
| Sospecha de compromiso | Rotar `BETTER_AUTH_SECRET` y la credencial de base en Secrets Manager (invalida todas las sesiones), redesplegar y revisar `AuditEvent` |
| Incidente con datos personales | Registrar hechos y alcance, notificar al responsable del negocio y seguir los plazos de la Ley 1581; ver `data.md` |

## Qué no hacer
- No aplicar migraciones desde una máquina local: solo la tarea `migrator` del despliegue, con el usuario `migrator`.
- No conceder al usuario `app` permisos de DDL para "arreglar" algo: rompe el aislamiento de ADR-0003.
- No desactivar el healthcheck para que un despliegue pase: es la señal que dispara el rollback automático.
