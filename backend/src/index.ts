import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import voiceRouter from './routes/voice.js';
import { getVoiceCapabilities } from './services/gcp.js';
import { hasGroqKey } from './services/groq.js';
import { getLlmProvider } from './services/llm.js';
import { hasGeminiKey } from './services/rag.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Allow all origins (frontend on Vercel, local, etc.)
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  const capabilities = getVoiceCapabilities();
  res.json({
    status: 'ok',
    gemini: hasGeminiKey(),
    groq: hasGroqKey(),
    gcpCredentials: capabilities.gcp,
    voiceMode: capabilities.serverStt
      ? capabilities.stt === 'groq'
        ? 'groq'
        : 'gcp'
      : 'browser-fallback',
    capabilities,
  });
});

app.use('/api/voice', voiceRouter);

app.listen(PORT, () => {
  const caps = getVoiceCapabilities();
  console.log(`VDA backend running on http://localhost:${PORT}`);
  console.log(`  Groq API: ${hasGroqKey() ? 'configured (STT + LLM)' : 'NOT SET'}`);
  console.log(`  Gemini API: ${hasGeminiKey() ? 'configured' : 'NOT SET'}`);
  console.log(`  GCP credentials: ${caps.gcp ? 'configured' : 'NOT SET'}`);
  console.log(`  STT provider: ${caps.stt}`);
  console.log(`  LLM provider: ${getLlmProvider()}`);
  if (!caps.serverStt) {
    console.log(`  Tip: Add GROQ_API_KEY for reliable server-side speech (free)`);
  }
});
