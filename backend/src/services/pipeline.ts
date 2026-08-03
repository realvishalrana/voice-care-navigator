import {
  classifyIntent,
  getFallbackMessage,
  getOutOfScopeMessage,
  isLowConfidence,
} from './intent.js';
import { detectLanguage } from './language.js';
import {
  generateAnswer,
  generateAnswerOffline,
  hasAnyLlmKey,
  retrieveContext,
} from './rag.js';
import {
  alertClinician,
  checkSafety,
  getEscalationMessage,
} from './safety.js';
import type { UseCase, VoiceProcessResponse } from '../types.js';

export interface PipelineInput {
  text: string;
  sessionId: string;
  sttConfidence?: number;
  sttLanguage?: string;
}

export interface PipelineResult {
  type: VoiceProcessResponse['type'];
  text: string;
  transcript?: string;
  intent?: UseCase;
  reason?: string;
  sources?: string[];
  responseLang: string;
}

export function processTranscript(input: PipelineInput): PipelineResult {
  const { text, sessionId, sttConfidence, sttLanguage } = input;
  const responseLang = detectLanguage(text, sttLanguage);

  if (sttConfidence !== undefined && (!text.trim() || sttConfidence < 0.4)) {
    return {
      type: 'fallback',
      text: getFallbackMessage(responseLang),
      transcript: text,
      responseLang,
    };
  }

  if (!text.trim()) {
    return {
      type: 'fallback',
      text: getFallbackMessage(responseLang),
      responseLang,
    };
  }

  // SAFETY FIRST — even in mixed sentences ("sugar check AND chest pain")
  const safety = checkSafety(text);
  if (safety.escalate) {
    alertClinician(sessionId, safety.reason ?? 'unknown', text);
    return {
      type: 'escalation',
      text: getEscalationMessage(responseLang),
      transcript: text,
      reason: safety.reason,
      responseLang,
    };
  }

  const intent = classifyIntent(text);
  if (isLowConfidence(intent.confidence)) {
    return {
      type: 'out_of_scope',
      text: getOutOfScopeMessage(responseLang),
      transcript: text,
      intent: intent.useCase,
      responseLang,
    };
  }

  return {
    type: 'answer',
    text: '', // filled async by caller
    transcript: text,
    intent: intent.useCase,
    responseLang,
    sources: [],
  };
}

export async function generatePipelineAnswer(
  result: PipelineResult,
  transcript: string,
): Promise<PipelineResult> {
  if (result.type !== 'answer' || !result.intent) {
    return result;
  }

  const { context, sourceIds } = retrieveContext(result.intent, transcript);
  const answer = hasAnyLlmKey()
    ? await generateAnswer(transcript, context, result.intent, result.responseLang)
    : generateAnswerOffline(context);

  return { ...result, text: answer, sources: sourceIds };
}
