import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasGroqKey } from './groq.js';
import { generateRagAnswer } from './llm.js';
import type { KnowledgeChunk, KnowledgeFile, UseCase } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '../knowledge');

const knowledgeIndex: KnowledgeFile[] = [
  loadKnowledge('adherence.json'),
  loadKnowledge('pmjay.json'),
  loadKnowledge('facilities.json'),
  loadKnowledge('triage.json'),
];

function loadKnowledge(filename: string): KnowledgeFile {
  const raw = readFileSync(join(KNOWLEDGE_DIR, filename), 'utf-8');
  return JSON.parse(raw) as KnowledgeFile;
}

function scoreChunk(chunk: KnowledgeChunk, query: string): number {
  const q = query.toLowerCase();
  let score = 0;
  for (const kw of chunk.keywords) {
    if (q.includes(kw.toLowerCase())) {
      score += 2;
    }
  }
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  for (const word of words) {
    if (chunk.content.toLowerCase().includes(word)) {
      score += 0.5;
    }
  }
  return score;
}

export function retrieveContext(
  useCase: UseCase,
  query: string,
  topK = 3,
): { context: string; sourceIds: string[] } {
  const file = knowledgeIndex.find((k) => k.useCase === useCase);
  if (!file) {
    return { context: '', sourceIds: [] };
  }

  const ranked = file.chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (ranked.length === 0) {
    const fallback = file.chunks.slice(0, 2);
    return {
      context: fallback.map((c) => c.content).join('\n\n'),
      sourceIds: fallback.map((c) => c.id),
    };
  }

  return {
    context: ranked.map((r) => r.chunk.content).join('\n\n'),
    sourceIds: ranked.map((r) => r.chunk.id),
  };
}

export async function generateAnswer(
  question: string,
  retrievedContext: string,
  useCase: UseCase,
  responseLang = 'hi-IN',
): Promise<string> {
  return generateRagAnswer(question, retrievedContext, useCase, responseLang);
}

export function generateAnswerOffline(retrievedContext: string): string {
  const sentences = retrievedContext.split(/(?<=[.!])\s+/).slice(0, 2);
  return sentences.join(' ') || 'कृपया अपने स्वास्थ्य केंद्र पर जाएं।';
}

export function hasGeminiKey(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'your-gemini-api-key',
  );
}

export function hasAnyLlmKey(): boolean {
  return hasGroqKey() || hasGeminiKey();
}
