import type { UseCase } from '../types.js';
import { getLanguageLabel, type LanguageCode } from './language.js';
import { getGroqClient, hasGroqKey } from './groq.js';
import { hasGeminiKey } from './rag.js';

const USE_CASE_LABELS: Record<UseCase, string> = {
  UC1: 'NCD medication and care adherence',
  UC2: 'PM-JAY government health scheme entitlement',
  UC3: 'finding public health facilities',
  UC4: 'teleconsultation and non-urgent health guidance',
};

const UNKNOWN_ANSWER: Partial<Record<LanguageCode, string>> & { default: string } = {
  default: 'मुझे इस बारे में पक्की जानकारी नहीं है। कृपया अपने स्वास्थ्य केंद्र पर जाएं।',
  'hi-IN': 'मुझे इस बारे में पक्की जानकारी नहीं है। कृपया अपने स्वास्थ्य केंद्र पर जाएं।',
  'en-IN': 'I do not have reliable information about this. Please visit your health center.',
  'gu-IN': 'મારી પાસે આ વિશે ચોક્કસ માહિતી નથી. કૃપા કરીને તમારા આરોગ્ય કેન્દ્રે જાઓ.',
  'kn-IN': 'ಇದರ ಬಗ್ಗೆ ನನಗೆ ಖಚಿತ ಮಾಹಿತಿ ಇಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆರೋಗ್ಯ ಕೇಂದ್ರಕ್ಕೆ ಹೋಗಿ.',
  'ta-IN': 'இதைப் பற்றி என்னிடம் உறுதியான தகவல் இல்லை. உங்கள் சுகாதார மையத்திற்குச் செல்லுங்கள்.',
  'te-IN': 'దీని గురించి నాకు ఖచ్చితమైన సమాచారం లేదు. దయచేసి మీ ఆరోగ్య కేంద్రానికి వెళ్లండి.',
};

function buildRagPrompt(
  question: string,
  retrievedContext: string,
  useCase: UseCase,
  responseLang: string,
): string {
  const langName = getLanguageLabel(responseLang as LanguageCode);
  return `You are VDA, a voice health navigation assistant for rural India.
Topic: ${USE_CASE_LABELS[useCase]}

STRICT RULES:
- Answer ONLY using the CONTEXT below. Do not use outside knowledge.
- Reply in ${langName} — the same language the patient used.
- If the answer is not in the context, say you don't have reliable information and ask them to visit their health center (in ${langName}).
- NEVER diagnose, prescribe, interpret lab results, or give clinical advice beyond the context.
- Use simple language a rural patient who cannot read will understand.
- Keep the answer short (2-4 sentences) — it will be read aloud.
- Do not mention that you are an AI.

CONTEXT:
${retrievedContext}

PATIENT QUESTION:
${question}

ANSWER (in ${langName}):`;
}

async function generateWithGroq(prompt: string): Promise<string> {
  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 350,
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

async function generateWithGemini(prompt: string): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  return response.text?.trim() ?? '';
}

export type LlmProvider = 'groq' | 'gemini' | 'offline';

export function getLlmProvider(): LlmProvider {
  if (hasGroqKey()) return 'groq';
  if (hasGeminiKey()) return 'gemini';
  return 'offline';
}

export async function generateRagAnswer(
  question: string,
  retrievedContext: string,
  useCase: UseCase,
  responseLang = 'hi-IN',
): Promise<string> {
  const unknown =
    UNKNOWN_ANSWER[responseLang as LanguageCode] ?? UNKNOWN_ANSWER.default;

  if (!retrievedContext.trim()) {
    return unknown;
  }

  const prompt = buildRagPrompt(question, retrievedContext, useCase, responseLang);
  const provider = getLlmProvider();

  try {
    let text = '';
    if (provider === 'groq') {
      text = await generateWithGroq(prompt);
    } else if (provider === 'gemini') {
      text = await generateWithGemini(prompt);
    } else {
      const sentences = retrievedContext.split(/(?<=[.!])\s+/).slice(0, 2);
      return sentences.join(' ') || unknown;
    }

    if (!text) return unknown;
    return text;
  } catch (err) {
    console.error(`[RAG] ${provider} error:`, err);
    const firstSentence = retrievedContext.split(/[.!]/)[0]?.trim();
    return firstSentence ? `${firstSentence}.` : unknown;
  }
}
