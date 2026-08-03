# Design Trade-offs — VDA Assistant

This document explains **why** key decisions were made, what we gained, and what we gave up. Use this in interviews when asked "Why did you choose X over Y?"

---

## 1. Safety: Rules vs LLM

| | **Chosen: Deterministic regex** | Alternative: LLM-based triage |
|--|--------------------------------|-------------------------------|
| **Pros** | 100% predictable; no API cost; works offline; cannot be jailbroken | Handles novel phrasing; understands context |
| **Cons** | Misses unusual wording; needs manual pattern updates | Can hallucinate; may under-escalate; latency + cost |
| **Why we chose rules** | In healthcare, **false negative on emergency is unacceptable**. Rules run before LLM so the model cannot override. |

**Interview line:** *"Safety is a hard gate, not a soft prompt. The LLM never decides if something is an emergency."*

---

## 2. Intent: Keywords vs ML Classifier

| | **Chosen: Keyword scoring** | Alternative: Fine-tuned BERT / embedding classifier |
|--|----------------------------|---------------------------------------------------|
| **Pros** | Explainable; fast; no training data; easy to add Gujarati/Hindi terms | Better on paraphrases and code-mixed speech |
| **Cons** | Brittle for unseen phrases; tie-breaking on similar scores | Needs labeled data; harder to debug wrong predictions |
| **Why keywords** | Demo timeline + rural code-mixed speech is partially covered by multilingual keyword lists. Tests are deterministic. |

**Mitigation:** Regional health heuristics (`detectRegionalHealthQuestion`) catch symptom questions in Gujarati/Kannada/Tamil/Telugu.

---

## 3. RAG: Keyword Retrieval vs Vector Embeddings

| | **Chosen: Keyword scoring on JSON chunks** | Alternative: Pinecone / pgvector embeddings |
|--|-------------------------------------------|---------------------------------------------|
| **Pros** | No vector DB; instant startup; works offline; transparent scoring | Semantic similarity; handles synonyms better |
| **Cons** | "Nearest hospital" won't match "PHC location" without shared keywords | Infra cost; embedding API latency; harder to explain |
| **Why keywords** | Small curated knowledge base (4 files, ~20 chunks). Keyword match is sufficient for demo; each UC is isolated anyway. |

**Interview line:** *"We isolated indexes per use case so retrieval never crosses domains — PM-JAY info can't leak into medication answers."*

---

## 4. LLM: Groq vs Gemini vs Offline

| | **Groq (primary)** | **Gemini (fallback)** | **Offline excerpts** |
|--|-------------------|----------------------|---------------------|
| **Cost** | Free tier | Free tier | Zero |
| **Quality** | Good for RAG | Good for RAG | Fixed text snippets |
| **Latency** | ~1-2s | ~1-3s | Instant |
| **When used** | `GROQ_API_KEY` set | No Groq, has Gemini key | No API keys |

**Trade-off:** We accept external API dependency for better answers, but **always** have offline fallback so the demo never fully breaks.

---

## 5. STT: Server vs Browser

| | **Server STT (Groq Whisper)** | **Browser Web Speech API** |
|--|------------------------------|---------------------------|
| **Pros** | Works in more browsers; better Hindi/Gujarati; consistent | Zero server cost; lower latency |
| **Cons** | API rate limits; needs 2+ sec recording; network required | Chrome/Edge only; "network error" on some setups |
| **Why both** | Groq for reliable demo; browser as fallback when no API key or quota exhausted |

---

## 6. TTS: GCP vs Browser SpeechSynthesis

| | **GCP Wavenet** | **Browser TTS** |
|--|----------------|-----------------|
| **Pros** | Natural Hindi voices; consistent quality | Free; no credentials; works offline |
| **Cons** | Billing; limited regional language voices | Gujarati/Kannada voices often missing on Windows |
| **Why browser default** | Demo runs without GCP billing. Replay button compensates for weak regional voices. |

---

## 7. Session: In-Memory vs Database

| | **Chosen: In-memory Map** | Alternative: Redis / PostgreSQL |
|--|--------------------------|--------------------------------|
| **Pros** | Simple; no PII persistence; auto-expiry | Multi-instance scaling; audit trail |
| **Cons** | Lost on restart; single server only | Privacy risk if transcripts stored |
| **Why in-memory** | Requirement: no PII retention. We only track session ID + interaction count. |

**Production path:** Redis for session stickiness without storing health content.

---

## 8. Multi-Turn Memory: Stateless vs Conversational

| | **Chosen: Single-turn** | Alternative: Conversation history in LLM |
|--|------------------------|----------------------------------------|
| **Pros** | Simpler; less token cost; fewer hallucination risks | "What about tomorrow?" follow-ups work |
| **Cons** | Cannot reference prior answer | More complex; privacy concerns |
| **Why stateless** | Voice-first rural use case = one question at a time. `shouldAskFollowUp` is planned but not implemented. |

---

## 9. Audio Validation: Strict vs Permissive

| | **Chosen: Min 2 sec / 2000 bytes** | Alternative: Accept any audio |
|--|-----------------------------------|------------------------------|
| **Pros** | Prevents Groq "invalid media file" errors | Faster user interaction |
| **Cons** | User must hold mic longer | Wastes API calls on empty WebM headers |
| **Why strict** | MediaRecorder without timeslice produces invalid tiny files. Validation saves API quota and gives clear UX message. |

---

## 10. Escalation: Over-Escalate vs Under-Escalate

| | **Chosen: Over-escalate bias** | Alternative: Conservative escalation |
|--|-------------------------------|-------------------------------------|
| **Pros** | Patient safety; aligns with clinical triage | Fewer false alarms |
| **Cons** | "Sugar check + chest pain" still escalates (correct!) | Risk missing atypical emergency wording |
| **Why over-escalate** | Mixed sentences like "sugar check AND chest pain" must still trigger 108. Safety runs on full transcript. |

---

## 11. Out-of-Scope: Reject vs Best-Effort Answer

| | **Chosen: Hard reject below 0.3 confidence** | Alternative: LLM answers anyway |
|--|-----------------------------------------------|-------------------------------|
| **Pros** | No hallucinated answers about cricket, weather, recipes | Better UX for edge questions |
| **Cons** | Valid but unusual phrasing may get rejected | Model may invent medical advice |
| **Why reject** | Trust > coverage. User gets clear boundary message in their language. |

---

## 12. Architecture: Monolith vs Microservices

| | **Chosen: Monolith (Express)** | Alternative: Separate STT/LLM/safety services |
|--|-------------------------------|-----------------------------------------------|
| **Pros** | Fast to build; easy to demo; single deploy | Independent scaling per service |
| **Cons** | All components scale together | Ops complexity for a hackathon |
| **Why monolith** | Appropriate for MVP and interview demo scope. |

---

## 13. Summary Table for Quick Reference

| Decision | Choice | Main trade-off |
|----------|--------|----------------|
| Safety | Regex before LLM | Predictability over flexibility |
| Intent | Keywords | Explainability over accuracy |
| RAG | JSON + keywords | Simplicity over semantic search |
| STT | Groq + browser fallback | Reliability over zero-cost |
| TTS | Browser default | Free over voice quality |
| Sessions | In-memory, no PII | Privacy over persistence |
| Conversations | Single-turn | Safety over UX richness |
| Deployment | Monolith | Speed over scale |

---

## 14. What We Would Change for Production

1. **Vector RAG** — when knowledge base grows beyond ~100 chunks
2. **Redis rate limiter** — per IP and per session
3. **Clinician webhook** — real escalation instead of console.log
4. **Embedding intent classifier** — trained on rural health utterances
5. **On-device STT** — for offline villages with no connectivity
6. **Audit logs** — without storing PHI (hashed session + intent only)
