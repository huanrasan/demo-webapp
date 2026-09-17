# 0005. Desplegar en AWS us-east-1 con ECS on Fargate, ALB y RDS PostgreSQL Single-AZ

**Status:** Accepted
**Date:** 2026-09-17
**Deciders:** huanrasan (architect)
**Advice from:** Agente IA (propuesta inicial). Pendiente: platform, finops, security
**Supersedes:** -

## Context and problem
Decisión de producto: AWS. Requisitos (`spec.md`): contenedores sin servicios propietarios en el código de la app,
99,5 % mensual, RPO ≤ 24 h, RTO ≤ 4 h, TLS, cifrado en reposo, secretos desde un secret manager, piloto pequeño con
tope de costo. Clientes y negocio en Colombia; Ley 1581 permite transmitir a encargados en el exterior con contrato de
transmisión y no exige residencia local.

Nota: AWS App Runner no acepta clientes nuevos desde el 30 de abril de 2026
([aviso de AWS](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)); queda descartado.

Momento de decidir: antes de la fase release de este cambio (primer despliegue); la imagen de contenedor y los
healthchecks se construyen ya.

## Decision drivers
| Criterio | Peso |
|---|---|
| Disponibilidad 99,5 % y RPO/RTO sin operar servidores | 5 |
| Costo mensual del piloto | 4 |
| Seguridad por defecto (red, IAM, cifrado, parches) | 4 |
| Portabilidad (imagen OCI estándar, IaC) | 3 |
| Esfuerzo operativo para una persona | 3 |

## Options considered
1. **ECS on Fargate (servicios estándar)**: servicio `web` detrás de un ALB y servicio `worker` sin balanceador;
   RDS PostgreSQL Single-AZ; tareas en subredes públicas con IP pública y security groups restrictivos (sin NAT).
2. **ECS Express Mode**: igual base (Fargate + ALB) con aprovisionamiento simplificado; orientado a servicios web.
3. **EC2 con Docker Compose** (una instancia) + RDS: sin ALB, TLS en la instancia.
4. Do nothing / defer: sin entorno para el piloto.

## Trade-off analysis
| Criterion (weight) | ECS Fargate estándar | ECS Express Mode | EC2 + Compose | Do nothing |
|---|---|---|---|---|
| Disponibilidad sin servidores (5) | 4: reemplazo automático de tareas; RDS Single-AZ | 4 | 2: instancia única, parches propios | 0 |
| Costo (4) | 3: ≈ USD 77/mes (`cost.md`) | 3: similar (ALB compartido solo ahorra con varios servicios) | 4: sin ALB (precio EC2 no verificado) | 5 |
| Seguridad por defecto (4) | 4 | 4 | 2: SO y Docker a cargo propio | 0 |
| Portabilidad (3) | 4: imagen OCI + OpenTofu | 3: menos control declarativo del worker | 4 | 0 |
| Esfuerzo operativo (3) | 4 | 5 | 2 | 5 |
| **Total ponderado** | **72** | **72** | **52** | **35** |

Empate técnico entre 1 y 2. Se elige la opción 1 porque el worker no es un servicio web y los servicios estándar se
describen de forma completa y revisable en IaC.

## Decision
- **Región:** `us-east-1`. Latencia desde Colombia a medir en el piloto (objetivo p95 de página < 500 ms).
- **Cómputo:** ECS on Fargate ARM64. `web`: 0,5 vCPU / 1 GB, 1 tarea (escala a 2 si CPU > 60 %). `worker`: 0,25 vCPU /
  0,5 GB, 1 tarea. `migrate`: tarea única previa a cada despliegue.
- **Red:** VPC propia con 2 AZ; ALB público (HTTPS 443 con certificado ACM, 80 → 443); tareas en subredes públicas con IP
  pública, security group que solo acepta tráfico del ALB (web) y ninguno entrante (worker); RDS en subredes privadas,
  solo accesible desde los security groups de `web`, `worker` y `migrate`. Sin NAT Gateway (costo); revisar si se añade.
- **Datos:** RDS PostgreSQL 17 `db.t4g.micro` Single-AZ, gp3 20 GB cifrado con KMS, respaldos automáticos 35 días,
  protección contra borrado, credencial maestra gestionada por RDS en Secrets Manager, TLS obligatorio
  (`rds.force_ssl=1`).
- **Secretos y configuración:** Secrets Manager inyectado como variables de entorno por ECS; IAM task roles con mínimo
  privilegio (`web`/`worker`: `ses:SendEmail` en la identidad del dominio).
- **Imagen:** Dockerfile multi-etapa, Next.js `output: "standalone"`, usuario no root, sistema de archivos de solo
  lectura salvo `/tmp`, publicada en ECR con escaneo al subir.
- **CI/CD:** GitHub Actions con OIDC hacia un rol de despliegue (sin claves de larga duración).
- **IaC:** OpenTofu en `infra/` (módulos `network`, `database`, `service`, `email`, `observability`, `budget`), escrito
  en la fase release de este cambio. Etiquetas `app`, `env`, `owner`, `cost-center` en todos los recursos.
- **Observabilidad:** CloudWatch Logs (30 días), métricas de ECS/ALB/RDS/SES y alarmas (detalle en `design.md`).
- **Contratos:** contratos de transmisión de datos con AWS (DPA de AWS) registrados por el negocio responsable.

## Advice received
Ninguna externa todavía. Decisión del product owner el 2026-09-17: mantener esta topología y enmendar el tope de costo de `spec.md` a USD 90/mes. Aceptado por huanrasan (architect) el 2026-09-17; el recibo `sdlc approve` y la revisión del PR lo formalizan.

## Consequences
- Positive: sin servidores que parchear; reemplazo automático de tareas; respaldos y cifrado gestionados; IaC portable
  en su mayor parte (red y servicios son específicos de AWS, la app no).
- Negative / accepted trade-offs: RDS Single-AZ (caída de AZ = restaurar, dentro de RTO 4 h); ALB y 4 IPv4 públicas
  pesan ≈ 44 % del costo; el costo estimado (≈ USD 77) deja un margen de 14 % bajo el tope de USD 90 de `spec.md`; tareas con IP
  pública (mitigado con security groups, sin puertos entrantes salvo desde el ALB).
- Follow-up actions: medir latencia desde Colombia; prueba de restauración de RDS antes del lanzamiento; AWS Budget.

## Revisit triggers
- Costo real > USD 100/mes durante 2 meses.
- Disponibilidad medida < 99,5 % en un mes o un incidente de AZ que supere RTO.
- p95 de página > 500 ms atribuible a latencia de red desde Colombia (evaluar región `sa-east-1` o CDN).
- AWS abre una región en Colombia con los servicios requeridos.
