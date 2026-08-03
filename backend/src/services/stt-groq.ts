import { toFile } from 'groq-sdk';
import type { TranscriptResult } from '../types.js';
import { extensionForMime, normalizeMimeType, validateAudioBuffer } from './audio-utils.js';
import { detectLanguage, whisperLangToBcp47 } from './language.js';
import { getGroqClient } from './groq.js';

/**
 * Groq Whisper STT — supports auto language detection when languageCode is 'auto'.
 */
export async function transcribeWithGroq(
  audioBuffer: Buffer,
  languageCode = 'auto',
  mimeType = 'audio/webm',
): Promise<TranscriptResult> {
  const validation = validateAudioBuffer(audioBuffer);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const client = getGroqClient();
  const normalizedMime = normalizeMimeType(mimeType);
  const ext = extensionForMime(normalizedMime);

  const file = await toFile(audioBuffer, `recording.${ext}`, {
    type: normalizedMime,
  });

  const useAuto = !languageCode || languageCode === 'auto';

  try {
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      ...(useAuto ? {} : { language: languageCode.split('-')[0] }),
      response_format: 'verbose_json',
      temperature: 0,
    });

    const text = transcription.text?.trim() ?? '';
    const verbose = transcription as { language?: string };
    const detectedFromWhisper = whisperLangToBcp47(verbose.language);
    const detectedFromText = detectLanguage(text, 'auto');
    const language =
      detectedFromWhisper ??
      (useAuto ? detectedFromText : languageCode) ??
      detectedFromText;

    return {
      transcript: text,
      confidence: text.length > 0 ? 0.88 : 0,
      language,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('valid media file') || msg.includes('invalid_request')) {
      throw new Error(
        'Could not read audio. Hold the mic for at least 2 seconds while speaking, then release.',
      );
    }
    throw err;
  }
}
