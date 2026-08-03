/** Backend origin. Empty in local dev (Vite proxy). Set on Render to your backend URL. */
const origin = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const API_ORIGIN = origin;
export const API_BASE = `${origin}/api/voice`;
export const HEALTH_URL = `${origin}/health`;
