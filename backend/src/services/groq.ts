import Groq from 'groq-sdk';

let client: Groq | null = null;

export function hasGroqKey(): boolean {
  const key = process.env.GROQ_API_KEY;
  return Boolean(key && key !== 'your-groq-api-key' && key.length > 10);
}

export function getGroqClient(): Groq {
  if (!hasGroqKey()) {
    throw new Error('GROQ_API_KEY is not set');
  }
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}
