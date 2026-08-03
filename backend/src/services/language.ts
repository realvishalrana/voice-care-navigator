/**
 * Supported languages for rural India VDA.
 * STT: Groq Whisper auto-detects; GCP uses BCP-47 codes.
 * TTS: Browser SpeechSynthesis voices per locale.
 */

export type LanguageCode =
  | 'hi-IN'
  | 'en-IN'
  | 'gu-IN'
  | 'kn-IN'
  | 'ta-IN'
  | 'te-IN'
  | 'mr-IN'
  | 'bn-IN'
  | 'pa-IN'
  | 'or-IN';

export interface LanguageConfig {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  /** Unicode script detection range */
  scriptRange?: [number, number];
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिंदी', scriptRange: [0x0900, 0x097f] },
  { code: 'en-IN', label: 'English', nativeLabel: 'English' },
  { code: 'gu-IN', label: 'Gujarati', nativeLabel: 'ગુજરાતી', scriptRange: [0x0a80, 0x0aff] },
  { code: 'kn-IN', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', scriptRange: [0x0c80, 0x0cff] },
  { code: 'ta-IN', label: 'Tamil', nativeLabel: 'தமிழ்', scriptRange: [0x0b80, 0x0bff] },
  { code: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు', scriptRange: [0x0c00, 0x0c7f] },
  { code: 'mr-IN', label: 'Marathi', nativeLabel: 'मराठी', scriptRange: [0x0900, 0x097f] },
  { code: 'bn-IN', label: 'Bengali', nativeLabel: 'বাংলা', scriptRange: [0x0980, 0x09ff] },
  { code: 'pa-IN', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', scriptRange: [0x0a00, 0x0a7f] },
  { code: 'or-IN', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', scriptRange: [0x0b00, 0x0b7f] },
];

const SCRIPT_TO_LANG: Array<{ range: [number, number]; code: LanguageCode }> = [
  { range: [0x0a80, 0x0aff], code: 'gu-IN' },
  { range: [0x0c80, 0x0cff], code: 'kn-IN' },
  { range: [0x0b80, 0x0bff], code: 'ta-IN' },
  { range: [0x0c00, 0x0c7f], code: 'te-IN' },
  { range: [0x0980, 0x09ff], code: 'bn-IN' },
  { range: [0x0a00, 0x0a7f], code: 'pa-IN' },
  { range: [0x0b00, 0x0b7f], code: 'or-IN' },
  { range: [0x0900, 0x097f], code: 'hi-IN' },
];

/**
 * Detect response language from transcript text.
 * Priority: explicit hint → script detection → latin ratio → Hindi default.
 */
export function detectLanguage(
  transcript: string,
  hint?: string,
): LanguageCode {
  // 'auto' or missing hint → detect from spoken text only
  if (hint && hint !== 'auto' && isSupported(hint)) {
    return hint as LanguageCode;
  }

  const text = transcript.trim();
  if (!text) return 'hi-IN';

  const latinCount = (text.match(/[a-zA-Z]/g) ?? []).length;
  const latinRatio = latinCount / Math.max(text.length, 1);
  if (latinRatio > 0.7) return 'en-IN';

  for (const { range, code } of SCRIPT_TO_LANG) {
    let count = 0;
    for (const char of text) {
      const cp = char.codePointAt(0) ?? 0;
      if (cp >= range[0] && cp <= range[1]) count++;
    }
    if (count / text.length > 0.15) return code;
  }

  return latinRatio > 0.4 ? 'en-IN' : 'hi-IN';
}

const WHISPER_TO_BCP47: Record<string, LanguageCode> = {
  hi: 'hi-IN', en: 'en-IN', gu: 'gu-IN', kn: 'kn-IN', ta: 'ta-IN',
  te: 'te-IN', mr: 'mr-IN', bn: 'bn-IN', pa: 'pa-IN', or: 'or-IN',
};

export function whisperLangToBcp47(whisperLang?: string): LanguageCode | undefined {
  if (!whisperLang) return undefined;
  return WHISPER_TO_BCP47[whisperLang.toLowerCase()];
}

export function isSupported(code: string): boolean {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

export function getLanguageLabel(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.nativeLabel ?? code;
}

/** Whisper / Groq ISO 639-1 code */
export function toWhisperLang(code: LanguageCode): string {
  return code.split('-')[0];
}
