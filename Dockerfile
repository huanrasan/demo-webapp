# syntax=docker/dockerfile:1
# Dos imágenes desde el mismo Dockerfile (ADR-0005): `runner` ejecuta web y worker; `migrator` aplica migraciones.
# Separarlas deja el CLI de Prisma (Studio, pglite, TypeScript) fuera de lo que corre en producción.
# Base fijada por digest (threat-model T-15).
ARG NODE_IMAGE=node:24-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM deps AS prod-deps
# --ignore-scripts: el postinstall del proyecto ejecuta `prisma generate`, y el CLI ya no está en producción.
# @prisma/client declara el CLI como peer opcional, así que `prune` lo conserva: se elimina aquí, en la misma capa,
# para que no viaje en la imagen que ejecuta la aplicación (solo lo usa la imagen `migrator`).
RUN pnpm prune --prod --ignore-scripts && rm -rf \
    node_modules/.pnpm/prisma@* node_modules/.pnpm/@prisma+studio-core@* node_modules/.pnpm/@prisma+engines@* \
    node_modules/.pnpm/@electric-sql+pglite@* node_modules/.pnpm/effect@* node_modules/.pnpm/typescript@* \
    node_modules/.bin/prisma node_modules/prisma node_modules/typescript

# Base endurecida común a las dos imágenes: parches del sistema y sin gestores de paquetes. apt-get upgrade sacrifica
# reproducibilidad bit a bit frente al digest fijado, a cambio de no esperar a que la imagen base publique parches.
FROM ${NODE_IMAGE} AS hardened
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm \
    /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-v* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Imagen de ejecución: web (por defecto) y worker (node dist/worker.mjs). Sin CLI de Prisma.
FROM hardened AS runner
ENV PORT=3000
COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/package.json /app/next.config.ts ./
COPY --from=build --chown=root:root /app/dist ./dist
COPY --from=build --chown=node:node /app/.next ./.next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start"]

# Imagen de migraciones: tarea efímera previa a cada despliegue, con el usuario migrator (MIGRATION_DATABASE_URL).
FROM hardened AS migrator
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/package.json /app/prisma.config.ts ./
COPY --from=build --chown=root:root /app/prisma ./prisma
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]
