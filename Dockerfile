# One container for the whole product: the website (Next.js) in front, the API (FastAPI)
# behind it on localhost. One free Render service stays warm instead of two that each
# take a minute to wake up.

FROM node:22-bookworm-slim AS web
WORKDIR /web
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
# The browser talks to the site's own origin; the site forwards /api/v1 to the API.
ARG NEXT_PUBLIC_NARADA_URL
ENV NEXT_PUBLIC_NARADA_URL=$NEXT_PUBLIC_NARADA_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM python:3.13-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=web /usr/local/bin/node /usr/local/bin/node

WORKDIR /app/api
COPY services/narada/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/narada/main.py ./
COPY services/narada/app ./app

WORKDIR /app/web
COPY --from=web /web/.next/standalone ./
COPY --from=web /web/.next/static ./.next/static

COPY start.sh /app/start.sh
CMD ["bash", "/app/start.sh"]
