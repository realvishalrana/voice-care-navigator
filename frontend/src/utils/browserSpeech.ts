import type { LanguageCode, SpeakLanguageCode } from '../types';

export type AppLanguage = LanguageCode | 'auto';

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 800);
  });
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  languageCode: LanguageCode,
): SpeechSynthesisVoice | null {
  const lang = languageCode.split('-')[0];
  const langFull = languageCode;

  const tries: Array<(v: SpeechSynthesisVoice) => boolean> = [
    (v) => v.lang === langFull,
    (v) => v.lang.replace('_', '-') === langFull,
    (v) => v.lang.startsWith(`${lang}-`),
    (v) => v.lang.startsWith(lang) && v.name.toLowerCase().includes('google'),
    (v) => v.lang.startsWith(lang),
    (v) => v.lang === 'hi-IN' || v.lang.startsWith('hi'),
    (v) => v.lang.startsWith('en-IN') || v.lang.startsWith('en'),
    (v) => v.default,
  ];

  for (const test of tries) {
    const found = voices.find(test);
    if (found) return found;
  }
  return voices[0] ?? null;
}

export interface SpeakResult {
  ok: boolean;
  voiceUsed?: string;
  fallback?: boolean;
}

export async function speakWithBrowserTts(
  text: string,
  languageCode: SpeakLanguageCode,
): Promise<SpeakResult> {
  if (!isBrowserTtsSupported()) {
    return { ok: false };
  }

  window.speechSynthesis.cancel();
  const voices = await loadVoices();
  const voice = pickVoice(voices, languageCode);
  const fallback = voice ? !voice.lang.startsWith(languageCode.split('-')[0]) : true;

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;

    utterance.onend = () =>
      resolve({ ok: true, voiceUsed: voice?.name, fallback });
    utterance.onerror = () =>
      resolve({ ok: false, voiceUsed: voice?.name, fallback });

    window.speechSynthesis.speak(utterance);
  });
}

// --- STT types and helpers (unchanged exports below) ---

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function isBrowserSttSupported(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition),
  );
}

export function isBrowserTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSecureContextForStt(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}

export function getSttErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'network':
      return (
        'Voice recognition needs internet. Check Wi‑Fi, use Chrome on localhost:5173, ' +
        'or use Groq mode with GROQ_API_KEY.'
      );
    case 'not-allowed':
      return 'Microphone blocked. Allow mic permission in browser settings.';
    case 'no-speech':
      return 'No speech heard. Tap mic, speak clearly, then tap again.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'service-not-allowed':
      return 'Use http://localhost:5173 (not LAN IP).';
    default:
      return `Speech recognition failed (${errorCode}).`;
  }
}

function createRecognition(): SpeechRecognitionInstance | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export interface BrowserSttSession {
  stop: () => void;
  abort: () => void;
}

export interface BrowserSttResult {
  transcript: string;
  confidence: number;
}

export function startBrowserStt(
  languageCode: LanguageCode | SpeakLanguageCode,
  onInterim: (text: string) => void,
): { session: BrowserSttSession; result: Promise<BrowserSttResult> } {
  const recognition = createRecognition();
  if (!recognition) {
    return {
      session: { stop: () => {}, abort: () => {} },
      result: Promise.reject(
        new Error('Browser speech recognition not supported. Use Chrome or Edge.'),
      ),
    };
  }

  let finalTranscript = '';
  let confidence = 0.75;
  let settled = false;

  recognition.lang = languageCode === 'auto' ? 'hi-IN' : languageCode;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let resolveResult!: (value: BrowserSttResult) => void;
  let rejectResult!: (reason: Error) => void;

  const result = new Promise<BrowserSttResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const finish = (ok: boolean, errMsg?: string) => {
    if (settled) return;
    settled = true;
    if (ok && finalTranscript.trim()) {
      resolveResult({ transcript: finalTranscript.trim(), confidence });
    } else {
      rejectResult(new Error(errMsg ?? 'No speech detected. Please try again.'));
    }
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    for (let i = 0; i < event.results.length; i++) {
      const r = event.results[i];
      const alt = r[0];
      if (r.isFinal) {
        finalTranscript += alt.transcript;
        if (alt.confidence > 0) confidence = alt.confidence;
      } else {
        interim += alt.transcript;
      }
    }
    onInterim((finalTranscript + interim).trim());
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === 'aborted') return;
    settled = true;
    rejectResult(new Error(getSttErrorMessage(event.error)));
  };

  recognition.onend = () => {
    if (!settled) finish(Boolean(finalTranscript.trim()));
  };

  try {
    recognition.start();
  } catch {
    settled = true;
    rejectResult(new Error('Could not start speech recognition'));
  }

  const session: BrowserSttSession = {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        finish(Boolean(finalTranscript.trim()));
      }
    },
    abort: () => {
      settled = true;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      rejectResult(new Error('Recording cancelled'));
    },
  };

  return { session, result };
}

export function stopBrowserTts(): void {
  window.speechSynthesis?.cancel();
}

export function warmupBrowserVoices(): void {
  if (isBrowserTtsSupported()) {
    void loadVoices();
  }
}
