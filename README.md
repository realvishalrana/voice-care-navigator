# VDA — Virtual Digital Assistant

Voice-first health navigation assistant for rural NCD patients in India. Built for the Medtronic Labs AI & Data Science hiring challenge.

**Speak → STT → Intent → Safety Gate → RAG → TTS → Hear answer**

No reading. No typing. No diagnosis.

---

## Architecture

```
Patient (mic) → React UI → Node.js API
                              ├─ Google STT (hi-IN + en-IN)
                              ├─ Intent classifier (deterministic)
                              ├─ Safety gate (rules FIRST, no LLM)
                              ├─ RAG (isolated JSON per use case)
                              ├─ Gemini (answer from context only)
                              └─ Google TTS → audio response
```

### Use cases

| UC | Topic | Example |
|----|-------|---------|
| UC1 | NCD adherence | "मेरी दवाई कब लेनी है?" |
| UC2 | PM-JAY scheme | "क्या मैं PM-JAY के लिए eligible हूं?" |
| UC3 | Facility linkage | "नजदीकी PHC कहाँ है?" |
| UC4 | Teleconsult / triage | "डॉक्टर से बात करनी है" |

### Non-negotiables implemented

- **Low-confidence fallback** — never guesses intent or transcript
- **RAG from retrieved context** — answers grounded in `knowledge/*.json`, not model memory
- **Safety gate before LLM** — red-flag patterns (chest pain, stroke, etc.) trigger deterministic escalation; LLM cannot override
- **No PII retention** — in-memory sessions, wiped after 30 min or on explicit end
- **Swappable STT/TTS** — behind service interfaces

---

## Setup

### 1. Google Cloud (STT + TTS)

1. Create project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Speech-to-Text** and **Text-to-Speech** APIs
3. Create service account with roles: `Speech-to-Text User`, `Text-to-Speech User`
4. Download JSON key → `backend/credentials/service-account.json`

### 2. Groq API (recommended — free, no GCP billing)

1. Sign up at [console.groq.com](https://console.groq.com)
2. Create API key at [console.groq.com/keys](https://console.groq.com/keys)
3. Add to `backend/.env`:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```

**What Groq provides (free tier):**
- **Whisper STT** — records audio in browser, transcribes on server (no browser speech API issues)
- **Llama 3.3 LLM** — better RAG answers than offline mode

### 3. Gemini API (optional alternative LLM)

1. Get key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Add to `backend/.env` (used if Groq key not set)

### 4. Google Cloud (optional — STT + TTS)

Only needed if you want Google Cloud voice instead of Groq + browser TTS.

### 5. Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your keys
```

### 6. Install & run

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status |
| `/api/voice/session` | POST | Create session |
| `/api/voice/session/:id` | DELETE | End session (wipe PII) |
| `/api/voice/process` | POST | Audio → full pipeline |
| `/api/voice/text` | POST | Text-only (demo/testing) |

### Text demo (no mic)

```bash
curl -X POST http://localhost:3001/api/voice/text \
  -H "Content-Type: application/json" \
  -d '{"text": "मुझे सीने में दर्द है"}'
```

---

## Demo script (5–10 min)

1. **UC1** — "मुझे बताओ मेरी दवाई कब लेनी है" → adherence answer from RAG
2. **UC2** — "क्या मैं PM-JAY के लिए eligible हूं" → scheme info
3. **UC3** — "नजदीकी PHC कहाँ है" → facility info
4. **Safety** — "मुझे सीने में दर्द है" → escalation, 108 alert, NO LLM medical advice
5. **Fallback** — random off-topic → out-of-scope message
6. Walk through README: pipeline, safety-first design, RAG isolation, limitations

---

## Safety metrics (honest reporting)

| Check | Target | How measured |
|-------|--------|--------------|
| Red-flag recall | 100% | 7 patterns tested (chest pain, breathlessness, stroke, etc.) |
| False escalation | Acceptable | Better to over-escalate than miss |
| Low-confidence fallback | 100% | confidence < 0.35 → no guess |
| LLM override of safety | 0% | Safety runs before any LLM call |

---

## Knowledge base

Each use case has an isolated JSON index in `backend/src/knowledge/`:

- `adherence.json` — UC1
- `pmjay.json` — UC2
- `facilities.json` — UC3
- `triage.json` — UC4

Chunks are retrieved by keyword scoring within the use-case index only.

---

## Voice provider priority

| Priority | STT | LLM | TTS |
|----------|-----|-----|-----|
| 1 | Google Cloud | Groq → Gemini | Google Cloud |
| 2 | **Groq Whisper** (free) | **Groq Llama** (free) | Browser |
| 3 | Browser Web Speech | Offline excerpts | Browser |

**Recommended for demo:** Groq API key only — no GCP billing needed.

---

## Offline / free fallback mode (no GCP billing)

If GCP billing is not set up, the app **automatically uses browser free mode**:

| Step | Free mode (browser) | Full mode (GCP) |
|------|---------------------|-----------------|
| STT | Web Speech API (Chrome/Edge) | Google Cloud STT |
| Pipeline | Backend intent + safety + RAG | Same |
| TTS | Browser SpeechSynthesis | Google Cloud TTS |

**How to use free mode:**
1. Start backend + frontend (no `service-account.json` needed)
2. Open http://localhost:5173 in **Chrome or Edge**
3. Mode badge shows: `Free mode · Browser STT/TTS`
4. Tap mic → speak → tap again → hear answer

You can force mode via UI toggle: **Auto** | **Browser (Free)** | **Google Cloud**

**Gemini API key** is optional — without it, answers use offline RAG excerpts.

---

## Offline mode (legacy note)

Without `GEMINI_API_KEY`, the backend uses deterministic context excerpts (no LLM). STT/TTS in full GCP mode require credentials.

---

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, TypeScript
- **Backend:** Node.js, Express, TypeScript
- **STT/TTS:** Google Cloud (free tier: 60 min STT, 4M chars TTS/month)
- **LLM:** Gemini 2.0 Flash (free tier)

---

## AI tooling disclosure

Built with AI coding tools (Cursor). Architecture, safety rules, and product decisions reviewed by the author.

---

## Documentation (interview prep)

| Doc | Purpose |
|-----|---------|
| [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) | Simple 5-min explainer for interviewer |
| [docs/HLD.md](docs/HLD.md) | High-level design |
| [docs/LLD.md](docs/LLD.md) | Low-level design, APIs, modules |
| [docs/TRADE-OFFS.md](docs/TRADE-OFFS.md) | Design decisions and alternatives |
| [docs/INTERVIEW-QUESTIONS.md](docs/INTERVIEW-QUESTIONS.md) | Likely Q&A with answers |
| [docs/OPERATIONS-AND-EDGE-CASES.md](docs/OPERATIONS-AND-EDGE-CASES.md) | Rate limits, out-of-scope, errors |

Run tests: `cd backend && npm test` (22 testcase.json + 19 safety tests)
