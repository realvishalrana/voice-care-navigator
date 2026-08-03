import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasGroqKey } from './groq.js';
import { getLlmProvider } from './llm.js';
import { getSttProvider } from './stt-router.js';

export function hasGcpCredentials(): boolean {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return false;
  return existsSync(resolve(credPath));
}

export function getVoiceCapabilities() {
  const gcp = hasGcpCredentials();
  const groq = hasGroqKey();
  const stt = getSttProvider() ?? 'browser';
  const llm = getLlmProvider();

  return {
    gcp,
    groq,
    stt,
    tts: gcp ? 'gcp' : 'browser',
    llm,
    freeFallback: !gcp && !groq,
    serverStt: stt !== 'browser',
  };
}
