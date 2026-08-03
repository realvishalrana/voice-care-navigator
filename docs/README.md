# VDA Documentation Index

Interview and technical documentation for the Virtual Digital Assistant project.

---

## Start Here

| Document | Read when… |
|----------|------------|
| **[HOW-IT-WORKS.md](./HOW-IT-WORKS.md)** | You need a simple 5-minute explanation for the interviewer |
| **[INTERVIEW-QUESTIONS.md](./INTERVIEW-QUESTIONS.md)** | You want Q&A practice with suggested answers |

---

## Architecture

| Document | Contents |
|----------|----------|
| **[HLD.md](./HLD.md)** | High-level design, system context, layers, deployment view |
| **[LLD.md](./LLD.md)** | APIs, pipeline sequence, modules, data structures, thresholds |
| **[TRADE-OFFS.md](./TRADE-OFFS.md)** | Why we chose rules vs LLM, keywords vs embeddings, etc. |

---

## Operations

| Document | Contents |
|----------|----------|
| **[OPERATIONS-AND-EDGE-CASES.md](./OPERATIONS-AND-EDGE-CASES.md)** | Rate limits, out-of-scope, errors, troubleshooting |

---

## Quick Commands

```bash
# Run the app
cd backend && npm run dev    # port 3001
cd frontend && npm run dev   # port 5173

# Run all tests (41 assertions across 2 suites)
cd backend && npm test

# Test a question without mic
curl -X POST http://localhost:3001/api/voice/text \
  -H "Content-Type: application/json" \
  -d '{"text": "मुझे सीने में दर्द है"}'
```

---

## Suggested Reading Order (Before Interview)

1. [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) — understand the story
2. [HLD.md](./HLD.md) — see the big picture
3. [TRADE-OFFS.md](./TRADE-OFFS.md) — defend your decisions
4. [INTERVIEW-QUESTIONS.md](./INTERVIEW-QUESTIONS.md) — practice answers
5. [OPERATIONS-AND-EDGE-CASES.md](./OPERATIONS-AND-EDGE-CASES.md) — handle "what if" questions

---

## Project README

Main setup instructions: [../README.md](../README.md)
