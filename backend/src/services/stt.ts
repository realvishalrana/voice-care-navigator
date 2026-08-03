import speech from '@google-cloud/speech';
import type { TranscriptResult } from '../types.js';

const client = new speech.SpeechClient();

export interface SttOptions {
  languageCode?: string;
  alternativeLanguageCodes?: string[];
  encoding?: string;
  sampleRateHertz?: number;
}

/**
 * Swappable STT interface — Google Cloud Speech-to-Text.
 * Detects Hindi/English code-switching via alternativeLanguageCodes.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: SttOptions = {},
): Promise<TranscriptResult> {
  const {
    languageCode = 'hi-IN',
    alternativeLanguageCodes = ['en-IN'],
    encoding = 'WEBM_OPUS',
    sampleRateHertz = 48000,
  } = options;

  const request = {
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: encoding as 'WEBM_OPUS',
      sampleRateHertz,
      languageCode,
      alternativeLanguageCodes,
      enableAutomaticPunctuation: true,
      model: 'default',
    },
  };

  const [response] = await client.recognize(request);

  if (!response.results?.length) {
    return { transcript: '', confidence: 0 };
  }

  const best = response.results.reduce((a, b) => {
    const confA = a.alternatives?.[0]?.confidence ?? 0;
    const confB = b.alternatives?.[0]?.confidence ?? 0;
    return confB > confA ? b : a;
  });

  const alt = best.alternatives?.[0];
  return {
    transcript: alt?.transcript ?? '',
    confidence: alt?.confidence ?? 0.5,
    language: best.languageCode ?? undefined,
  };
}
