# How It Works — Simple Guide for Interview

Use this document to explain the VDA assistant in **5 minutes**. Read it top to bottom before your interview.

---

## The One-Liner

> **VDA is a voice-first health navigation assistant for rural India.**  
> Patients speak in Hindi, Gujarati, or English. The system listens, understands what they need, checks for emergencies, finds the right information, and speaks the answer back — **without reading or typing**.

---

## The Problem We Solve

| Reality in rural India | What VDA does |
|------------------------|---------------|
| Many patients cannot read | 100% voice in, voice out |
| Multiple languages + Hinglish | Auto-detect language, answer in same language |
| NCD patients forget medicines | UC1: adherence reminders from trusted docs |
| Don't know about PM-JAY | UC2: scheme eligibility from official info |
| Don't know where to go | UC3: nearest PHC/CHC guidance |
| Mild symptoms, need doctor | UC4: teleconsult guidance |
| Chest pain / breathlessness | **Immediate 108 escalation — not AI advice** |

---

## The 30-Second Demo Script

1. Open `http://localhost:5173`
2. Select **🌐 Auto** language
3. Hold mic and say: **"मुझे दवा कब लेनी है?"** → UC1 adherence answer
4. Say: **"Am I eligible for Ayushman Bharat?"** → UC2 scheme answer
5. Say: **"मुझे सीने में दर्द है"** → **Escalation: Call 108** (no LLM medical advice)
6. Say: **"What's the weather?"** → Out of scope message

---

## Step-by-Step: What Happens When User Speaks

Think of it as a **factory assembly line**. Each station does one job. Order matters.

```
🎤 USER SPEAKS
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 1: SPEECH-TO-TEXT (STT)                            │
│ "मुझे दवा कब लेनी है?" → text string                   │
│ Provider: Groq Whisper (free) or browser or GCP         │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 2: LANGUAGE DETECTION                              │
│ Detect Hindi → respond in Hindi (hi-IN)                 │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 3: SAFETY GATE ⚠️ (MOST IMPORTANT)                 │
│ Is this an emergency? (chest pain, can't breathe…)      │
│ YES → "Call 108 immediately" → STOP HERE                │
│ NO  → continue                                          │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 4: INTENT CLASSIFICATION                           │
│ What does the user want?                                │
│ UC1 medicine | UC2 scheme | UC3 hospital | UC4 consult  │
│ Low confidence → "I can only help with health topics"   │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 5: RAG — FIND RELEVANT KNOWLEDGE                   │
│ Search ONLY that use case's JSON file                   │
│ e.g. UC1 → adherence.json → medication schedule chunk   │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 6: LLM ANSWER (Groq Llama)                         │
│ "Answer ONLY from this context. Same language as user."   │
│ No diagnosis. No prescription.                          │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 7: TEXT-TO-SPEECH (TTS)                            │
│ Speak answer aloud (browser or GCP voice)               │
└─────────────────────────────────────────────────────────┘
    │
    ▼
🔊 USER HEARS ANSWER
```

---

## Why Safety Comes BEFORE Everything Else

**Interviewers will ask this.** Here's the answer:

> If we let the LLM run first, it might say "take rest" for chest pain.  
> Instead, we use **fixed rules** (regex patterns) that detect emergencies.  
> When matched, we return a **pre-written escalation message** and alert a health worker.  
> The LLM **never sees** emergency transcripts for answer generation.

**Example:** User says *"शुगर चेक कहाँ करवाएं और मुझे सीने में दर्द है"*  
→ Even though "sugar check" is UC1, **chest pain wins** → escalation.

---

## The Four Use Cases (UC1–UC4)

| UC | Name | Patient question | Knowledge file |
|----|------|------------------|----------------|
| **UC1** | Adherence | "When is my medicine?" | `adherence.json` |
| **UC2** | PM-JAY | "Am I eligible for Ayushman?" | `pmjay.json` |
| **UC3** | Facilities | "Where is nearest hospital?" | `facilities.json` |
| **UC4** | Teleconsult | "Talk to doctor online" | `triage.json` |

**Emergency is NOT UC4** — it's the Safety Gate (runs before UC routing).

---

## What "RAG" Means (Simple)

**RAG = Retrieval Augmented Generation**

Without RAG:
> LLM uses its training memory → might invent wrong medicine times ❌

With RAG:
> 1. Find relevant paragraphs from our JSON knowledge base  
> 2. Give ONLY those paragraphs to the LLM  
> 3. LLM summarizes in patient's language ✅

**Key rule:** Each use case has its **own** knowledge file. UC2 answers never pull from UC1 data.

---

## What Happens When Things Go Wrong

| Situation | System response | Type |
|-----------|-----------------|------|
| User releases mic too fast | "Hold mic for 2 seconds" | Error message |
| STT hears nothing | "I didn't understand. Speak again." | `fallback` |
| Question about cricket/weather | "I only help with health topics" | `out_of_scope` |
| Chest pain / breathlessness | "Call 108 immediately" | `escalation` |
| Groq API down | Browser STT mode or offline excerpts | Degraded mode |
| No API keys at all | Offline RAG text snippets | Still works partially |

---

## Tech Stack (One Sentence Each)

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | React + Vite + Tailwind | Fast UI, works on mobile browser |
| Backend | Node.js + Express + TypeScript | Simple API, easy to demo |
| STT | Groq Whisper | Free, good multilingual |
| LLM | Groq Llama 3.3 | Free, fast RAG answers |
| TTS | Browser SpeechSynthesis | No billing needed |
| Knowledge | JSON files | Transparent, editable, no vector DB |
| Tests | 22 testcase.json + safety tests | Prove multilingual + safety works |

---

## Privacy Story (Important for Medtronic)

- Sessions are **in-memory only** — no database
- We store: session ID + interaction count
- We **do not store**: voice recordings, transcripts, patient name
- Sessions **expire after 30 minutes**
- User can end session explicitly (`DELETE /session/:id`)

**Interview line:** *"We designed for minimal data retention because rural health contexts have high privacy sensitivity."*

---

## How to Run Before Interview

```bash
# Terminal 1
cd vda-assistant/backend
npm run dev

# Terminal 2
cd vda-assistant/frontend
npm run dev

# Terminal 3 — prove tests pass
cd vda-assistant/backend
npm test
```

Add to `backend/.env`:
```
GROQ_API_KEY=gsk_your_key
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

---

## Files to Point To If Asked "Show Me the Code"

| If they ask about… | Open this file |
|--------------------|----------------|
| Safety rules | `backend/src/services/safety.ts` |
| Pipeline order | `backend/src/services/pipeline.ts` |
| Intent keywords | `backend/src/services/intent.ts` |
| Knowledge / RAG | `backend/src/knowledge/adherence.json` + `rag.ts` |
| API endpoints | `backend/src/routes/voice.ts` |
| Voice recording UI | `frontend/src/hooks/useVoiceSession.ts` |
| Test cases | `backend/src/test/testcases.json` |

---

## Closing Statement for Interview

> "I built a voice-first assistant where **safety is deterministic and runs before AI**, answers are **grounded in curated health documents** rather than model memory, and the system **degrades gracefully** to free browser APIs when cloud billing isn't available. It's designed for rural patients who speak Hindi, Gujarati, or mixed languages — not for urban English-only users."

---

## Related Docs

- [HLD.md](./HLD.md) — architecture diagrams
- [LLD.md](./LLD.md) — API and module details
- [TRADE-OFFS.md](./TRADE-OFFS.md) — why we chose each approach
- [INTERVIEW-QUESTIONS.md](./INTERVIEW-QUESTIONS.md) — Q&A prep
- [OPERATIONS-AND-EDGE-CASES.md](./OPERATIONS-AND-EDGE-CASES.md) — rate limits, errors
