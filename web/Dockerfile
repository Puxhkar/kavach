FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Baked into the client bundle at build time; Railway passes service variables as build args.
ARG NEXT_PUBLIC_NARADA_URL
ENV NEXT_PUBLIC_NARADA_URL=$NEXT_PUBLIC_NARADA_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=build /app ./
# Railway (and most hosts) pass the port in $PORT.
CMD ["sh", "-c", "pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]
