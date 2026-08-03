import { hasGcpCredentials } from './gcp.js';
import { hasGroqKey } from './groq.js';
import { transcribeWithGroq } from './stt-groq.js';
import { transcribeAudio as transcribeWithGcp } from './stt.js';
import type { TranscriptResult } from '../types.js';

export type SttProvider = 'gcp' | 'groq';

export function getSttProvider(): SttProvider | null {
  if (hasGcpCredentials()) return 'gcp';
  if (hasGroqKey()) return 'groq';
  return null;
}

/**
 * Route STT to best available provider: GCP → Groq → null (use browser).
 */
export async function transcribeAudioAuto(
  audioBuffer: Buffer,
  options: {
    languageCode?: string;
    alternativeLanguageCodes?: string[];
    mimeType?: string;
    provider?: SttProvider;
  } = {},
): Promise<TranscriptResult & { provider: SttProvider }> {
  const {
    languageCode = 'hi-IN',
    alternativeLanguageCodes = ['en-IN', 'hi-IN'],
    mimeType = 'audio/webm',
    provider,
  } = options;

  const chosen = provider ?? getSttProvider();

  if (chosen === 'gcp' && hasGcpCredentials()) {
    const result = await transcribeWithGcp(audioBuffer, {
      languageCode,
      alternativeLanguageCodes,
    });
    return { ...result, provider: 'gcp' };
  }

  if (hasGroqKey()) {
    const result = await transcribeWithGroq(audioBuffer, languageCode, mimeType);
    return { ...result, provider: 'groq' };
  }

  throw new Error('No STT provider configured. Add GROQ_API_KEY or GCP credentials.');
}
