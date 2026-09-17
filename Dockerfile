# syntax=docker/dockerfile:1
# Imagen única para web, worker y migrate (ADR-0005). Base fijada por digest (threat-model T-15).
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
RUN pnpm prune --prod

FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
WORKDIR /app
# Parches del sistema base y menos superficie: la imagen final ejecuta node directamente, npm y corepack solo
# aportan dependencias vulnerables (threat-model T-15).
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/package.json /app/next.config.ts /app/prisma.config.ts ./
COPY --from=build --chown=root:root /app/prisma ./prisma
COPY --from=build --chown=root:root /app/dist ./dist
COPY --from=build --chown=node:node /app/.next ./.next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# web (por defecto). worker: node dist/worker.mjs. migrate: node node_modules/prisma/build/index.js migrate deploy
CMD ["node", "node_modules/next/dist/bin/next", "start"]
