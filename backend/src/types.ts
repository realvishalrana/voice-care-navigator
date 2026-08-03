export type UseCase = 'UC1' | 'UC2' | 'UC3' | 'UC4';

export type ResponseType =
  | 'answer'
  | 'fallback'
  | 'escalation'
  | 'out_of_scope';

export interface TranscriptResult {
  transcript: string;
  confidence: number;
  language?: string;
}

export interface IntentResult {
  useCase: UseCase;
  confidence: number;
  matchedKeywords: string[];
}

export interface SafetyResult {
  escalate: boolean;
  reason?: string;
  action?: string;
  matchedPattern?: string;
}

export interface KnowledgeChunk {
  id: string;
  topic: string;
  keywords: string[];
  content: string;
}

export interface KnowledgeFile {
  useCase: UseCase;
  title: string;
  chunks: KnowledgeChunk[];
}

export interface VoiceProcessResponse {
  type: ResponseType;
  transcript?: string;
  intent?: UseCase;
  text: string;
  audio: string;
  reason?: string;
  sources?: string[];
  sessionId: string;
  ttsMode?: 'gcp' | 'browser';
  responseLang?: string;
  sttProvider?: 'gcp' | 'groq';
}

export interface SessionData {
  id: string;
  createdAt: number;
  interactions: number;
}
