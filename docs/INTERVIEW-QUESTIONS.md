# Interview Questions & Answers — VDA Assistant

Likely questions for the Medtronic Labs AI & Data Science hiring challenge, with suggested answers based on this project.

---

## Product & Problem Understanding

### Q1: Why voice-first? Why not a chatbot with text?

**Answer:** Rural NCD patients often have low literacy. Voice removes the reading barrier. They already use WhatsApp voice notes — voice is a natural interface. We still show text for caregivers who can read, but the primary path is speak → hear.

### Q2: Why these four use cases (UC1–UC4)?

**Answer:** They map to the Medtronic challenge scope:
- **UC1** — chronic disease adherence (medicines, follow-ups)
- **UC2** — financial access (PM-JAY scheme)
- **UC3** — physical access (where to go)
- **UC4** — clinical access (teleconsult for mild issues)

Emergencies are handled separately by the safety gate, not as a fifth use case.

### Q3: What is VDA NOT allowed to do?

**Answer:**
- Diagnose diseases
- Prescribe medicines
- Replace a doctor
- Answer non-health questions confidently

When unsure, it says "contact your health center" or returns out-of-scope.

---

## Architecture & Design

### Q4: Walk me through the pipeline when a user speaks.

**Answer:** (Use the diagram from [HOW-IT-WORKS.md](./HOW-IT-WORKS.md))

STT → language detection → **safety gate** → intent classification → RAG retrieval → LLM answer → TTS.

Safety runs before intent because a mixed sentence like "sugar check and chest pain" must escalate even if the intent classifier picks UC1.

### Q5: Why is safety deterministic and not LLM-based?

**Answer:** LLMs can hallucinate, be inconsistent, and add latency. In emergencies we need **100% predictable** behavior. Regex rules are testable — we have 19 safety tests and 22 multilingual test cases. The LLM cannot override safety because it never runs on escalated transcripts.

### Q6: How does RAG work in your system?

**Answer:** We have 4 isolated JSON knowledge files (one per use case). When intent is UC2, we search only `pmjay.json`. Chunks are scored by keyword matches. Top 3 chunks go into the LLM prompt with strict instructions: answer only from context, in the user's language, no diagnosis.

### Q7: Why keyword RAG instead of vector embeddings?

**Answer:** Small knowledge base (~20 chunks), hackathon timeline, and explainability. I can show exactly which keywords matched. For production at scale, I'd move to embeddings — see [TRADE-OFFS.md](./TRADE-OFFS.md).

### Q8: How do you handle multilingual input?

**Answer:** Three layers:
1. **STT** — Groq Whisper with auto language detection
2. **Script detection** — Unicode ranges for Hindi, Gujarati, Kannada, etc.
3. **LLM prompt** — "Respond in {detected language}"

UI supports 10 languages + Auto mode.

### Q9: What is the difference between `/process` and `/text` endpoints?

**Answer:**
- `/process` — accepts audio file, runs server STT (Groq/GCP), then pipeline
- `/text` — accepts text directly, skips STT (used for browser STT path and testing)

Both share the same pipeline after transcription.

---

## Safety & Clinical

### Q10: What happens if someone says "I have chest pain"?

**Answer:** Safety gate matches `chest pain` pattern → returns `type: escalation` → pre-written message: "Call 108 immediately" → `alertClinician()` logs the event. **No LLM is called.** This is tested in `testcases.json` (EN005, HI005, MX007).

### Q11: What if STT mishears "chest" as "chest pen"?

**Answer:** We added STT typo patterns like `chest pen` in safety rules. Better to over-escalate than miss. This is a deliberate trade-off.

### Q12: How do you measure safety?

**Answer:**
| Metric | How |
|--------|-----|
| Red-flag recall | `safety.test.ts` — 9 must-escalate cases |
| No false escalation on routine | 4 must-not-escalate cases |
| Multilingual emergencies | `testcases.json` HI005, GU005, EN005 |
| LLM override | 0% — safety runs before LLM |

### Q13: Would you trust this in production for triage?

**Answer:** Honestly, **no — not as-is.** This is an MVP for navigation, not clinical triage. Production would need clinician review, FHIR integration, regulatory compliance, and a validated symptom checker. The safety gate is a **first filter**, not a replacement for 108/emergency services.

---

## Technical Deep-Dive

### Q14: How do you handle low STT confidence?

**Answer:** If confidence < 0.4 or transcript is empty, return `type: fallback` with "I didn't understand. Please speak again." We never guess intent on bad audio.

### Q15: How do you handle out-of-scope questions?

**Answer:** Intent classifier returns confidence < 0.3 → `type: out_of_scope` with a fixed message in the detected language. Explicit blocklist keywords (weather, cricket) force confidence to 0. See [OPERATIONS-AND-EDGE-CASES.md](./OPERATIONS-AND-EDGE-CASES.md).

### Q16: What if Groq API is down or rate-limited?

**Answer:** Degradation path:
1. Try GCP STT if credentials exist
2. Fall back to browser Web Speech API → `/text`
3. LLM fails → offline RAG excerpts
4. Return `useBrowserFallback: true` in error response

See operations doc for production rate-limit strategy.

### Q17: Why hold-to-speak for 2+ seconds?

**Answer:** MediaRecorder without timeslice produces invalid tiny WebM files. Groq rejects them with "invalid media file." We validate min 2000 bytes on backend and 1.5s on frontend.

### Q18: How are sessions managed?

**Answer:** In-memory Map, UUID per session, 30-min TTL, stores only interaction count — no transcripts or PII. Purged every 5 minutes. Production would use Redis without storing health content.

### Q19: How do you test the system?

**Answer:**
```bash
cd backend && npm test
```
- `safety.test.ts` — 19 safety/intent/language tests
- `testcases.test.ts` — 22 multilingual scenarios from `testcases.json`

Each testcase validates: escalation, intent/use case, RAG context availability.

---

## Trade-offs & Alternatives

### Q20: What would you improve with more time?

**Answer:**
1. Vector RAG for better semantic retrieval
2. Real clinician escalation webhook (SMS/WhatsApp to ASHA worker)
3. Rate limiting and retry with exponential backoff
4. On-device STT for offline villages
5. Multi-turn conversation with session context (carefully, with privacy)
6. Fine-tuned intent model on rural health utterances

### Q21: Why Groq instead of only Google Cloud?

**Answer:** GCP billing setup failed in my environment (`OR_BACR2_44`). Groq provides free Whisper STT + Llama LLM — enough for a reliable demo without credit card. GCP remains supported when credentials are available.

### Q22: Monolith vs microservices?

**Answer:** Monolith is correct for MVP — one deploy, one demo, faster iteration. Microservices make sense when STT and LLM need independent scaling.

---

## Behavioral / Process

### Q23: Did you use AI tools to build this?

**Answer:** Yes — Cursor AI for scaffolding and boilerplate. I reviewed all safety rules, pipeline order, and test cases myself. Architecture decisions (safety-first, RAG isolation, no PII) were intentional, not auto-generated.

### Q24: How did you prioritize features?

**Answer:**
1. Safety gate (non-negotiable)
2. Core pipeline STT → intent → RAG → answer
3. Multilingual support
4. Free-tier fallbacks (Groq + browser)
5. Test suite for interview confidence
6. UI polish (replay button, hold-to-speak)

### Q25: Tell me about a bug you fixed.

**Answer:** Groq returned "invalid media file" because users released the mic too quickly. Root cause: empty WebM without MediaRecorder timeslice. Fix: `recorder.start(250)`, min 2-second hold, backend byte validation before API call. Documented in operations guide.

---

## Rapid-Fire Cheat Sheet

| Question | One-line answer |
|----------|-----------------|
| Safety before LLM? | Yes, always |
| Stores patient data? | No, in-memory session ID only |
| Diagnoses? | Never |
| Languages? | 10 + auto detect |
| RAG source? | 4 JSON files, isolated per UC |
| Emergency handling? | Regex → 108 message, no LLM |
| Low confidence? | Fallback, don't guess |
| Out of scope? | Fixed rejection message |
| Free to run? | Yes, with Groq key + browser TTS |
| Tests? | 22 testcase.json + 19 safety tests |

---

## Questions YOU Should Ask Them

1. How does Medtronic Labs handle clinical validation for AI assistants in the field?
2. What languages and dialects are highest priority for your patient population?
3. Is integration with ASHA workers or eSanjeevani on the roadmap?
4. What safety metrics do you require before pilot deployment?

---

## Related Docs

- [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) — 5-minute explainer
- [HLD.md](./HLD.md) — architecture
- [TRADE-OFFS.md](./TRADE-OFFS.md) — design decisions
- [OPERATIONS-AND-EDGE-CASES.md](./OPERATIONS-AND-EDGE-CASES.md) — rate limits, errors
