export type ResponseType = 'answer' | 'fallback' | 'escalation' | 'out_of_scope';

export type VoiceMode = 'auto' | 'gcp' | 'groq' | 'browser';

export type RecordingMode = 'server' | 'browser';

export interface VoiceResponse {
  type: ResponseType;
  transcript?: string;
  intent?: string;
  text: string;
  audio: string;
  reason?: string;
  sources?: string[];
  sessionId: string;
  ttsMode?: 'gcp' | 'browser';
  sttProvider?: 'gcp' | 'groq';
  responseLang?: SpeakLanguageCode;
  ttsFallback?: boolean;
}

export interface HealthCapabilities {
  gcp: boolean;
  groq: boolean;
  stt: 'gcp' | 'groq' | 'browser';
  tts: 'gcp' | 'browser';
  llm: 'groq' | 'gemini' | 'offline';
  serverStt: boolean;
}

export interface HealthStatus {
  status: string;
  gemini: boolean;
  groq: boolean;
  gcpCredentials: boolean;
  voiceMode: string;
  capabilities: HealthCapabilities;
}

export type LanguageCode =
  | 'auto'
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

/** Language for TTS playback (never 'auto') */
export type SpeakLanguageCode = Exclude<LanguageCode, 'auto'>;

export const USE_CASE_LABELS: Record<string, string> = {
  UC1: 'दवाई और देखभाल',
  UC2: 'सरकारी योजना',
  UC3: 'अस्पताल खोजें',
  UC4: 'डॉक्टर से सलाह',
};

export const DEMO_PROMPTS = [
  { label: 'दवाई कब लें?', text: 'मुझे बताओ मेरी दवाई कब लेनी है' },
  { label: 'PM-JAY योग्यता', text: 'क्या मैं PM-JAY के लिए eligible हूं' },
  { label: 'નજીકની હોસ્પિટલ', text: 'નજીકની હોસ્પિટલ ક્યાં છે' },
  { label: '⚠️ સીને દુખાવ', text: 'મને છાતીમાં દુખાવ થાય છે' },
];

export const VOICE_MODE_LABELS: Record<VoiceMode, string> = {
  auto: 'Auto',
  groq: 'Groq (Free)',
  gcp: 'Google Cloud',
  browser: 'Browser',
};
