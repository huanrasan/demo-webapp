# Cost: plataforma de reservas en AWS (piloto, una instalación)

## Estimate
Región `us-east-1`, precios on-demand en USD, mes = 730 h. Topología de ADR-0005.

| Component | Pricing driver (unit) | Assumed volume | Monthly cost | Environment |
|---|---|---|---|---|
| ECS Fargate `web` (ARM64, 0,5 vCPU / 1 GB) | USD 0,03238 por vCPU-h + USD 0,00356 por GB-h | 1 tarea × 730 h | 14,42 | production |
| ECS Fargate `worker` (ARM64, 0,25 vCPU / 0,5 GB) | ídem | 1 tarea × 730 h | 7,21 | production |
| ECS Fargate `migrate` (tarea única) | ídem | ≈ 10 ejecuciones × 5 min | < 0,05 | production |
| Application Load Balancer | USD 0,0225 por hora + USD 0,008 por LCU-h | 730 h + 0,5 LCU promedio | 19,35 | production |
| IPv4 públicas | USD 0,005 por IP-h | 4 IP (2 del ALB, 1 `web`, 1 `worker`) × 730 h | 14,60 | production |
| RDS PostgreSQL `db.t4g.micro` Single-AZ | USD 0,016 por hora | 730 h | 11,68 | production |
| RDS almacenamiento gp3 | USD 0,115 por GB-mes | 20 GB | 2,30 | production |
| RDS respaldos | USD 0,095 por GB-mes sobre la asignación gratuita (= almacenamiento aprovisionado) | < 20 GB con 35 días de retención (supuesto) | 0,00 | production |
| Amazon SES (à la carte) | USD 0,10 por 1.000 emails | 30.000 emails | 3,00 | production |
| Secrets Manager | USD 0,40 por secreto-mes + USD 0,05 por 10.000 llamadas | 2 secretos, llamadas solo al arrancar tareas | 0,80 | production |
| CloudWatch Logs | USD 0,50 por GB ingerido sobre 5 GB gratis de la cuenta; USD 0,03 por GB-mes almacenado | ≈ 3 GB/mes, retención 30 días | 0,10 | production |
| CloudWatch alarmas | USD 0,10 por alarma-mes | 6 alarmas | 0,60 | production |
| CloudWatch métricas personalizadas (Embedded Metric Format) | USD 0,30 por métrica-mes (primeras 10.000) | 9 métricas: 3 de cola + `email.sent`/`email.failed` × 3 categorías | 2,70 | production |
| Route 53 | USD 0,50 por zona + USD 0,40 por millón de consultas | 1 zona, < 1 M consultas | 0,50 | production |
| ECR | USD 0,10 por GB-mes | ≈ 1 GB (imágenes con política de retención de 10) | 0,10 | production |
| ACM, KMS (clave gestionada por AWS), transferencia de salida | Sin cargo o dentro de la capa gratuita (100 GB/mes de salida) | < 5 GB/mes | 0,00 | production |
| Staging efímero (web + worker + ALB + 4 IPv4 + RDS) | Mismos precios | ≤ 160 h/mes: entorno creado y destruido con IaC por cada validación de release | 16,40 | non-production |

Total monthly (production): 77,40 USD (estimado)
Total monthly (non-production): 16,40 USD (estimado) (desarrollo local con Docker Compose, sin costo de nube)

Cálculo de staging: Fargate `web` (0,5 × 0,03238 + 1 × 0,00356) × 160 = 3,16; `worker` 1,58; ALB 0,0225 × 160 = 3,60;
IPv4 4 × 0,005 × 160 = 3,20; RDS 0,016 × 160 = 2,56; gp3 20 GB = 2,30 (se cobra aunque la instancia esté detenida). Total 16,40.

## Assumptions
- **Tráfico:** ≤ 200 reservas/día, ≤ 2.000 clientes, 20 usuarios concurrentes en pico (`spec.md`). 0,5 LCU promedio en
  el ALB es un supuesto a medir en el piloto.
- **Emails:** ≈ 1.000/día (confirmación + recordatorio por reserva, cancelaciones y enlaces mágicos) ≈ 30.000/mes.
- **Datos:** base < 2 GB el primer año; respaldos incrementales dentro de la asignación gratuita (supuesto a verificar
  con el uso real de backup storage).
- **Logs:** ≈ 3 GB/mes; la capa gratuita de 5 GB de CloudWatch Logs es por cuenta y puede estar consumida por otros usos.
- **Sin** NAT Gateway, Multi-AZ, WAF, reservas de capacidad ni Savings Plans.
- **Fuentes y fecha (2026-09-17):** Price List API de AWS para Fargate (publicación 2026-09-11) y RDS (vigencia
  2026-09-01); páginas públicas de precios de ELB, VPC, SES, Secrets Manager, CloudWatch, Route 53 y ECR.
- **No verificado:** precio de EC2 para la alternativa de instancia única; se excluye de la comparación numérica.

## Unit economics
- Por reserva: USD 77,40 / (200 × 30) ≈ **USD 0,013**.
- Por cliente registrado: USD 77,40 / 2.000 ≈ **USD 0,039/mes**.
- Costo fijo dominante: ALB + IPv4 públicas ≈ USD 33,95 (44 %) no dependen del volumen; con menos reservas el costo
  unitario sube linealmente.

## Alternatives
| Alternativa | Producción/mes | Ahorro | Trade-off |
|---|---|---|---|
| Recomendada (ADR-0005) | ≈ 77,40 | - | Worker independiente: los despliegues de `web` no interrumpen recordatorios |
| `web` y `worker` como dos contenedores en una sola tarea (0,5 vCPU / 1 GB compartidos) | ≈ 66,55 | 10,85 (sin tarea `worker` ni su IPv4) | Un fallo o despliegue de la tarea detiene ambos; compiten por CPU |
| Tareas en subredes privadas con NAT Gateway | ≈ 103,20 | −25,80 (NAT 0,045 × 730 = 32,85, + ≈ 5 GB procesados × 0,045, − 2 IPv4 de tareas 7,30) | Tareas sin IP pública; más caro |
| RDS `db.t4g.small` en lugar de `micro` | ≈ 89,10 | −11,68 | 2 GB de RAM; margen si el pool de conexiones o pg-boss presionan la memoria |
| Compute Savings Plan 1 año sobre Fargate | a cotizar | hasta 50 % del cómputo según AWS | Compromiso de 12 meses antes de validar el piloto |

**Tope de `spec.md`:** el tope original de ≤ USD 50/mes no era alcanzable con ALB gestionado (la alternativa más
barata ≈ USD 66,55). El product owner enmendó el spec a ≤ USD 90/mes el 2026-09-17 y mantuvo la topología de
ADR-0005. Margen del estimado recomendado frente al tope: ≈ USD 12,60 (14 %).

## Guardrails
- **AWS Budget** mensual de USD 90 para producción con alertas al 50 %, 80 % y 100 % real, y al 100 % pronosticado,
  enviadas al email del responsable; budget de USD 25 para staging. Definidos en el módulo IaC `budget`.
- **Etiquetas obligatorias** en todos los recursos: `app=booking`, `env=prod|staging`, `owner`, `cost-center`;
  activadas como cost allocation tags. Política en CI (Checkov/Conftest) que falla si falta alguna.
- **Staging efímero:** el ALB y las IPv4 se cobran mientras existen aunque no haya tareas, así que staging no se apaga; se crea con IaC (`tofu apply`) para validar un release y se destruye al terminar (`tofu destroy`), con datos
  sintéticos cargados por script; nunca datos de producción. El estimado supone ≤ 160 h/mes; el budget de staging
  alerta si se excede. El almacenamiento de 2,30 se mantiene como margen conservador.
- **Retención de costos variables:** logs 30 días, imágenes ECR máximo 10, snapshots manuales borrados tras 35 días
  salvo el previo a cada migración de datos.
- **Revisión:** comparar el costo real con este estimado en `outcome.md` al cierre del primer mes del piloto.
