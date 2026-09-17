# Architecture Decision Records

Format: `NNNN-kebab-title.md`, with a `**Status:**` line (`Proposed`, `Accepted`, `Rejected`, `Deprecated`,
`Superseded by NNNN`). Start from `template.md`. Never delete accepted ADRs; supersede them.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-monolito-nextjs-single-tenant-por-capas.md) | Construir un monolito Next.js single-tenant con capas de dominio aisladas | Accepted |
| [0002](0002-better-auth-enlace-magico-y-segundo-factor-staff.md) | Autenticar con Better Auth: enlace mágico para todos y segundo factor obligatorio para el personal | Accepted |
| [0003](0003-postgresql-prisma-single-tenant.md) | Persistir en PostgreSQL con Prisma, una base por instalación y restricciones de integridad en la base | Accepted |
| [0004](0004-email-ses-y-tareas-con-pg-boss.md) | Enviar email con Amazon SES tras una interfaz propia y ejecutar tareas programadas con pg-boss en un worker | Accepted |
| [0005](0005-despliegue-aws-ecs-fargate.md) | Desplegar en AWS us-east-1 con ECS on Fargate, ALB y RDS PostgreSQL Single-AZ | Accepted |
