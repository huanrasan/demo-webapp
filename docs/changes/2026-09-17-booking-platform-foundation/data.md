# Data: base de datos de la plataforma de reservas

Responsable del tratamiento: cada negocio que instala la app (single-tenant). Encargados: AWS (hospedaje, base de
datos, email). Rol `data-steward` del proyecto: huanrasan.

## Data changes
Este cambio crea la base vacía, la migración inicial y el esquema de la cola (`pgboss`). Las entidades de negocio se
materializan en cada cambio `feature` según el modelo conceptual de ADR-0003; se clasifican aquí para que las features
hereden la clasificación y la retención.

| Entity / dataset | Change | Classification (public, internal, confidential, restricted) | Owner |
|---|---|---|---|
| `_prisma_migrations` | Crear (migración inicial vacía) | internal | tech-lead |
| Esquema `pgboss` (trabajos, archivo) | Crear al arrancar el worker (pg-boss lo gestiona) | confidential (payload solo con IDs, nunca datos personales) | tech-lead |
| `User` (nombre, email, teléfono, rol, declaración de mayoría de edad) | Conceptual; feature de registro | confidential | data-steward |
| `Session`, `Account`, `Verification`, `TwoFactor`, `Passkey` | Conceptual; feature de registro | restricted (secretos TOTP, tokens con hash, credenciales públicas WebAuthn) | security |
| `Consent` (versión de política, aceptada en) | Conceptual; feature de registro | confidential | data-steward |
| `Service`, `Resource`, `WorkingHours`, `TimeOff` | Conceptual; features de disponibilidad y panel | internal | product-owner |
| `Booking` (cliente, recurso, servicio, inicio, fin, estado, origen) | Conceptual; feature de reserva | **restricted** en instalaciones de salud (la combinación cliente + servicio puede revelar salud); confidential en el resto | data-steward |
| `AuditEvent` (actor, acción, entidad, ID, fecha; append-only) | Conceptual; feature del panel (threat-model T-18) | confidential (solo IDs) | security |
| Logs de aplicación (CloudWatch) | Crear | internal (sin datos personales por diseño, AC-10) | sre |
| Respaldos RDS | Crear | restricted (contienen todo lo anterior) | sre |

La clasificación de `Booking` depende del tipo de negocio; para no ramificar controles, **se aplica `restricted` a
`Booking` en todas las instalaciones**: acceso solo por rol `staff`/`admin` con segundo factor, sin exportaciones
masivas en el piloto y sin nombre de servicio en emails (ADR-0004).

## Migrations
- Herramienta: Prisma Migrate (ADR-0003). `prisma migrate deploy` corre en la tarea `migrate` antes de desplegar
  `web`/`worker`; nunca al arrancar cada contenedor.
- Usuario `migrator` (DDL) solo en la tarea de migración; usuario `app` (DML) en `web` y `worker`.
- Todas las migraciones siguen expand/contract: (1) añadir columnas/tablas nullable o con default; (2) desplegar código
  que escribe en ambos formatos; (3) backfill idempotente por lotes de 1.000 filas; (4) cambiar lecturas; (5) eliminar
  lo antiguo en un despliegue posterior.
- SQL manual permitido solo para lo que Prisma no modela (`btree_gist`, `EXCLUDE`), en el mismo archivo de migración y
  con comentario del motivo.
- Volumen de este cambio: base vacía; duración < 1 min. Volumen esperado al año 1: < 2 GB.
- CI verifica que `pnpm db:migrate` aplica sobre base vacía y que no quedan migraciones pendientes (AC-2).

## Rollback
- Migración inicial: reversible borrando la base (sin datos). Rollback de aplicación = desplegar la imagen anterior;
  la base expandida es compatible hacia atrás.
- Migraciones futuras: snapshot manual de RDS inmediatamente antes de cada migración que transforme o borre datos.
  Punto de no retorno: el paso "contract" (borrado de columnas o datos); requiere confirmación humana explícita y
  snapshot verificado.
- Restauración completa: point-in-time recovery de RDS (retención 35 días) dentro de RTO 4 h; procedimiento probado
  una vez antes del lanzamiento y documentado en `runbook.md`.

## Retention and lineage
| Dataset | Retención | Mecanismo de borrado |
|---|---|---|
| Cuenta de cliente activa | Mientras esté activa | - |
| Cuenta de cliente inactiva (sin inicio de sesión ni reservas) | 24 meses desde la última actividad | Tarea mensual pg-boss: anonimiza `User` (nombre, email y teléfono reemplazados; se conserva ID) y borra sesiones y factores |
| Reservas pasadas | 24 meses desde la fecha del turno | Tarea mensual: anonimiza el vínculo con el cliente; se conservan fecha, recurso, estado y origen agregados para métricas |
| `Consent` | Mientras exista la cuenta + 5 años tras anonimizar (prueba de la autorización ante reclamos; plazo a validar con asesor legal) | Tarea mensual |
| `AuditEvent` | 24 meses (igual que reservas) | Tarea mensual: borrado de eventos vencidos |
| Tokens de enlace mágico | 10 minutos | Expiración + limpieza diaria |
| Sesiones | Clientes 30 días; personal 8 h | Expiración + limpieza diaria |
| Trabajos de cola completados | 7 días (archivo pg-boss) | Configuración de pg-boss |
| Logs de aplicación | 30 días | Retención de CloudWatch Logs |
| Respaldos automáticos RDS | 35 días | Retención de RDS; los datos borrados o anonimizados desaparecen de los respaldos a los 35 días |
| Snapshots manuales previos a migración | 35 días | Borrado manual registrado en `runbook.md` |

Lineage: fuente única = formularios de la app (cliente y personal). Consumidores: la propia app, el worker (emails), SES
(email y fecha/hora de la cita, sin servicio), CloudWatch (métricas sin datos personales), respaldos RDS. Sin
analítica externa, exportaciones, cachés compartidas ni índices de búsqueda en el piloto.

## Privacy impact (required when the change declares the personal-data scope)
| Question | Answer |
|---|---|
| Personal data categories | Identificación y contacto: nombre, email, teléfono. Declaración de mayoría de edad (booleano, sin fecha de nacimiento). Agenda: fechas y horas de citas, servicio reservado, asistencia. Autenticación: sesiones, factores (TOTP con secreto cifrado, credenciales públicas de passkey). Sin datos sensibles (Ley 1581 art. 5): sin motivo de consulta, notas ni diagnósticos. Riesgo: el servicio reservado en consultorios puede inferir salud → `Booking` restricted |
| Purpose and lawful basis | Gestionar reservas, recordatorios y la agenda del negocio. Base: autorización previa, expresa e informada del titular (Ley 1581 art. 9; Decreto 1377 de 2013) otorgada al registrarse, con prueba (`Consent`). Reservas creadas por el personal a nombre de un cliente requieren que el negocio haya obtenido la autorización por su canal y lo declare en el panel |
| Data minimization | Solo los campos listados; sin fecha de nacimiento (booleano de mayoría de edad), sin documento de identidad, sin dirección, sin IP persistida en tablas de negocio. Payloads de cola solo con IDs. Logs sin datos personales (AC-10). Emails sin nombre de servicio |
| Retention and deletion | Ver tabla de retención. Anonimización en lugar de borrado físico de reservas para preservar integridad de agenda y métricas agregadas |
| Data subject rights (access, rectification, erasure, portability) | Acceso y rectificación: el cliente ve y edita su perfil y reservas en la app. Supresión y revocatoria: botón "Eliminar mi cuenta" que anonimiza de inmediato (reservas futuras canceladas antes) y registra la solicitud. Consultas y reclamos fuera de la app: canal del negocio publicado en la política; plazos 10 y 15 días hábiles (spec). Portabilidad: exportación JSON de perfil y reservas propias (feature del panel del cliente). Las features correspondientes implementan y prueban cada derecho |
| Cross-border transfers and residency | Datos alojados en AWS `us-east-1` (Estados Unidos). Ley 1581 no exige residencia local; se trata como transmisión a encargado en el exterior con contrato de transmisión (DPA de AWS) que el negocio responsable debe tener. La política de tratamiento debe informar la ubicación. A validar con asesor legal |
| Processors / third parties | AWS (ECS, RDS, SES, CloudWatch, Secrets Manager) como encargado. Ningún otro tercero en el piloto (sin analítica, sin CDN de terceros, sin fuentes web externas: se sirven desde la app) |
| Residual risk and approver | (1) Inferencia de salud por nombre de servicio visible al personal: aceptado, mitigado con acceso restringido y segundo factor. (2) Menor que declara falsamente ser adulto: aceptado (decisión de producto). (3) Datos en EE. UU.: aceptado con contrato de transmisión. (4) Interpretación legal no validada: bloquea release hasta revisión de asesor. Aprobador: rol `data-steward` o `security` (huanrasan) |
