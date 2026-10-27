# Kavach: AI call shield and voice-agent lab

**Kavach** ("shield") is the product; the code still lives under `services/narada` and `web/`.

**Call Guard** answers your phone when you're busy. It finds out who is calling and why, tells
them when you're free, spots scam calls, and ranks every call in a priority inbox. **Scam
drills** let an AI scammer call your parents so they can practise saying no. Speech in both
directions is Gnani (Prisma speech-to-text, Timbre text-to-speech); the thinking is a free
local model through Ollama. The **Agent Lab** (below) stress-tests other voice agents.

| Part | Stack |
|---|---|
| `services/narada/` | Python 3.13, FastAPI, motor (MongoDB), pytest, ruff |
| `web/` | Next.js 16, React 19, Tailwind 4, TanStack Query, react-hook-form + zod 3 |

The first click-through prototype is kept in [prototype/](prototype/).

## Call Guard

- **Assistant.** Answers as "<your name>'s assistant", asks who is calling, from where and why (one
  question at a time), tells the caller when you're free (Settings → "When are you free?"), and ends
  the call. It never shares or confirms your number, address, bank details, OTPs, Aadhaar or PAN,
  never agrees to pay or install an app, and treats threats and demands for secrecy as scam signs.
- **Languages.** Settings → "Languages people may speak" (up to 4; Gnani's speech recognition
  listens for up to four per request and reports which one it heard). The assistant opens in the
  opening language (English by default) and answers in whatever language the other person speaks;
  every transcript line shows its language and a "Switched to Kannada" marker where it changed.
- **Call for me** (`/call-guard/errands`). Tell the assistant who to call and what to say ("Pushkar:
  finish the client deck, by today EOD"). It introduces itself as your assistant, asks which
  language they prefer, switches to it, delivers the message and deadline, repeats back any
  question or condition, and reports: agreed / needs follow-up / declined / not reached, what they
  committed to, and your next step. Run it live (hand the device to the person) or let an AI play
  them in a chosen language. A "no, but tomorrow" counts as needs follow-up, not declined.
- **Start page** (`/call-guard`): four choices — answer a call, call someone for me, practise a scam call, test a voice agent.
- **Answer calls** (`/call-guard/live`): talk to the assistant yourself or let an AI caller ring it; your calls are listed underneath, most important first, and each opens in a side panel.
- **Triage** (in each call's panel). Each call gets a triage: caller, organisation or relation,
  purpose, category, priority, scam risk 0–100, red flags, what the caller was told about a call
  back, a summary and one suggested action, plus the recording and transcript (with what speech
  recognition heard). The model only advises; the rules in `app/domain/guard/rules.py` decide:
  a scam risk of 70+ is always **blocked**, even if the caller claims to be Mom; a VIP from Settings
  is at least **high**; sales are never above **low**.
- **Try it.** "Simulate an incoming call" lets an AI caller ring the assistant (fake CBI "digital
  arrest", KYC-OTP, electricity cut-off, customs parcel, Mom with an emergency, a recruiter, a
  genuine bank RM, a delivery partner on a noisy road, a credit-card telecaller). **Answer a call**
  puts you on the line through the browser microphone.
- **Scam drill** (`/call-guard/drill`). An AI scammer calls you or a family member. Afterwards: a
  score, a verdict (stayed safe / at risk / got scammed — sharing an OTP, paying, installing an app
  or giving bank details is an automatic fail), what went right or wrong, tips, and a message ready
  to share on WhatsApp.
- **Not yet:** answering your real phone number. That needs a telephony provider (Plivo, Exotel or
  Twilio) and call forwarding on your SIM; the assistant already works turn by turn, so a phone line
  can feed it the same way the browser does. Call Guard data is kept in memory and is cleared on
  restart.

## Agent Lab: what works today

Sidebar: **Agent prompt · Edge-case testing · Calls & recordings · Manual test call**. Agent setup is two
steps, **① Connect → ② Describe**, then you go to Edge-case testing. Built so far:

- **Agents list**, with loading, empty and error states.
- **① Connect.** Name, vendor (Plivo AgentFlow or Vapi) and the flow or assistant ID. Mis-pasted IDs are
  rejected on the field.
- **② Describe.** Five clearly separated sections:
  - **Prompt.** A copy for analysis; editing it does not change the live agent.
  - **Call inputs** (*sent into the call*), e.g. `name`, `job_role`.
  - **Answers to collect** (*collected from the candidate*), each with a saved format such as "Amount in LPA"
    or "Duration in days".
  - **Rules** (must / must never).
  - **Languages, language-switch behaviour and how a good call ends.**

  New agents start from a screening template. A key used as both a call input and an answer is rejected,
  because that mix-up was the main confusion in the prototype.
- **Prompt versions.** Saving a changed prompt creates v2, v3 and so on. Whitespace-only edits don't.
  Earlier versions are never rewritten.
- **Edge-case testing** (`/agent-testing/tests?agent=…`): pick candidate situations (built per agent
  by the backend, including its languages), repeats and a mode (voice or chat), then **Run tests**.
  Saving an agent's setup lands here.
- **Chat-mode test runs.** For each situation × repeat the service:
  1. writes a fake candidate with ground-truth answers;
  2. plays the call in text, with the agent's saved prompt on one side and the candidate on the other;
  3. scores it against the agent's rules, answer formats, language setting and call ending.

  The verdict is computed from the checks, not taken from the judge. Runs execute in the background,
  3 at a time, with a 30-conversation limit per run. The text side uses any OpenAI-compatible language
  model; the default is a free local model through Ollama, so no cloud AI key is needed.
- **Voice-mode test runs** (the default when `GNANI_API_KEY` is set). Same as chat, but Gnani speaks
  every line: one voice for the agent, a voice matching the candidate's gender for the candidate. The
  candidate's audio is transcribed back, and the agent only receives that transcript, so mishearing
  shows up (a name like "Meera" heard as "Mira", Hinglish arriving in Devanagari). Each conversation keeps a WAV
  recording in `services/narada/var/recordings/`, which is git-ignored. It is still the agent's prompt
  on our LLM, not the deployed agent on a phone line, so barge-in and phone latency don't show up yet.
  Gnani's starter plan allows one request at a time, so speech calls queue (`GNANI_MAX_PARALLEL_REQUESTS`).
  A 3-conversation voice run takes about 2 minutes.
- **Noisy phone line** (voice runs only). The candidate's audio goes through what a weak mobile call
  does to speech before Gnani transcribes it: the 300–3400 Hz telephone band, 8 kHz sampling, 8-bit
  μ-law, and street rumble about 6 dB under the voice. The recording keeps the degraded audio, so you
  hear what the agent heard. At this level Gnani keeps most words but salary amounts start to drift
  ("6.5 lakh" arriving as "65,500"), which is exactly when a good agent reads the number back.
- **Calls & recordings** (`/agent-testing/calls?agent=…&run=…&conversation=…`) lists the runs. Each
  conversation shows its failed checks first, expected vs. collected answers, the transcript (live while
  running) and the test candidate. Voice runs add a player. Each line has a "play from here" button and
  is highlighted while it plays, and under every candidate line is what the agent heard.
- **Manual test call** still shows a disabled "Call me" button. Phone calls need Plivo and Vapi test
  accounts.
- The selected agent is kept in the URL (`?agent=`), so reloads and shared links keep it.

## Run it locally

```bash
# Backend: http://localhost:8010 (API docs at /docs)
cd services/narada
make install          # creates .venv with Python 3.13 via uv
cp .env.example .env # then fill GNANI_API_KEY (voice runs need it)
ollama pull gemma3:12b && ollama serve   # the local language model; set LLM_MODEL to match
make run              # STORAGE_BACKEND=memory in .env: no database, data is lost on restart
                      # STORAGE_BACKEND=mongo + MONGODB_CONNECTION_URL=mongodb://localhost:27217
                      # uses the narada-mongo container (Docker Desktop must be running)
make seed             # optional: loads 3 example agents for UI work

# Frontend: http://localhost:3000
cd web
pnpm install
cp .env.example .env.local
pnpm dev
```

**Database.** Narada has its own Mongo in a Docker container, `narada-mongo` (port 27217, database
`narada`, collections `narada_agents` and `narada_runs`). It restarts with Docker Desktop. To
create it on another machine:
`docker run -d --name narada-mongo --restart unless-stopped -p 127.0.0.1:27217:27017 -v narada-mongo-data:/data/db mongo:8.0`

`web/pnpm-workspace.yaml` must stay. Without it, pnpm walks up the folders and installs into the first
workspace it finds (on this machine, the home folder).

## Checks

```bash
cd services/narada && make test-mongo && make lint # 113 tests (make test skips the 6 Mongo ones)
cd web && pnpm test && pnpm lint && pnpm typecheck  # 32 tests
```

## Safety built in

- No secrets in code. Everything is read from env vars (`.env.example` in each app); `.env` files are git-ignored.

## Notes

- `web/ui/components/ui/*` holds the small UI kit (button, card, badge, input, typography, skeleton).
- Reads throw on failure so TanStack Query sees the error; writes return `{ success: false }` so forms
  can show field errors inline.
- Schemas live in `agentTesting.schemas.ts` rather than inside each form, because two steps and the tests
  share them.
- Mongo collection names are prefixed `narada_` and stored camelCase.
