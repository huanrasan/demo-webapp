---
id: MEM-2026-09-17-el-cli-de-prisma-en-dependencias-de-producción-arrastra-cve
type: pitfall
title: El CLI de Prisma en dependencias de producción arrastra CVE
tags: prisma, dependencias, seguridad, docker
source: docs/changes/2026-09-17-booking-platform-foundation/verification.md
created: 2026-09-17
review_by: 2027-03-16
status: active
superseded_by:
---
prisma (CLI) está en dependencies para poder ejecutar migrate dentro de la imagen; arrastra @prisma/studio-core, mysql2 y deepmerge-ts, que aportaron 3 CVE altas en el primer CI. Se mitigó con overrides en pnpm-workspace.yaml. Al actualizar Prisma, revisar Trivy antes de asumir que los overrides siguen siendo necesarios o suficientes.
