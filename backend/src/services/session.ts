import type { SessionData } from '../types.js';

const sessions = new Map<string, SessionData>();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function createSession(): SessionData {
  const session: SessionData = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    interactions: 0,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): SessionData | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function touchSession(id: string): void {
  const session = sessions.get(id);
  if (session) {
    session.interactions += 1;
  }
}

export function endSession(id: string): void {
  sessions.delete(id);
}

/** Wipe all sessions — no PII retained after session ends */
export function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

setInterval(purgeExpiredSessions, 5 * 60 * 1000);
