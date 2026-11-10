# Deploying Kavach

Two parts, two hosts:

| Part | Host | Root directory |
|---|---|---|
| Backend (`services/narada`, FastAPI) | Railway | `services/narada` (builds the Dockerfile there) |
| Website and app (`web`, Next.js) | Vercel | `web` |

Secrets go in each host's dashboard. Never commit a `.env` file.

## 1. Backend on Railway

New project → Deploy from GitHub repo → set **Root Directory** to `services/narada`. Then add
these variables (Service → Variables):

| Variable | Value |
|---|---|
| `STORAGE_BACKEND` | `memory` (or `mongo` with a MongoDB Atlas URL in `MONGODB_CONNECTION_URL`) |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | `llama-3.3-70b-versatile` |
| `LLM_JSON_MODE` | `json_object` |
| `LLM_API_KEY` | your Groq key (console.groq.com) — secret |
| `GNANI_API_KEY` | your Gnani key — secret |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://kavach.vercel.app` |

Settings → Networking → Generate Domain. `https://<that domain>/health` should answer
`{"status":"ok",...}`.

With `STORAGE_BACKEND=memory`, agents, runs and calls reset on every redeploy, and recordings
live on the container disk. For data that survives, use MongoDB Atlas and attach a Railway
volume at `/app/var`.

## 2. Website on Vercel

Add New → Project → import the GitHub repo → set **Root Directory** to `web`. Add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_NARADA_URL` | the Railway URL, e.g. `https://kavach-production.up.railway.app` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (uses the pnpm version pinned in `web/package.json`) |

Deploy. Then put the Vercel URL into Railway's `CORS_ORIGINS` and redeploy the backend.

The microphone only works over HTTPS, which both hosts provide.
