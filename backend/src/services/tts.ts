import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient();

const VOICE_MAP: Record<string, { name: string; gender: 'FEMALE' | 'MALE' }> = {
  'hi-IN': { name: 'hi-IN-Wavenet-A', gender: 'FEMALE' },
  'en-IN': { name: 'en-IN-Wavenet-A', gender: 'FEMALE' },
  'ta-IN': { name: 'ta-IN-Wavenet-A', gender: 'FEMALE' },
  'te-IN': { name: 'te-IN-Standard-A', gender: 'FEMALE' },
  'kn-IN': { name: 'kn-IN-Wavenet-A', gender: 'FEMALE' },
};

/**
 * Swappable TTS interface — Google Cloud Text-to-Speech.
 */
export async function synthesizeSpeech(
  text: string,
  languageCode = 'hi-IN',
): Promise<Buffer> {
  const voice = VOICE_MAP[languageCode] ?? VOICE_MAP['hi-IN'];

  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode,
      name: voice.name,
      ssmlGender: voice.gender,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.92,
      pitch: 0,
    },
  });

  if (!response.audioContent) {
    throw new Error('TTS returned empty audio');
  }

  return Buffer.from(response.audioContent as Uint8Array);
}
