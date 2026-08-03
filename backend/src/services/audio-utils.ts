/** Minimum bytes for a valid audio clip (empty webm headers are ~200-500 bytes) */
export const MIN_AUDIO_BYTES = 2000;

export function normalizeMimeType(mime?: string): string {
  if (!mime) return 'audio/webm';
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base.includes('webm')) return 'audio/webm';
  if (base.includes('wav')) return 'audio/wav';
  if (base.includes('ogg')) return 'audio/ogg';
  if (base.includes('mp4') || base.includes('m4a')) return 'audio/mp4';
  return 'audio/webm';
}

export function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

export function validateAudioBuffer(buffer: Buffer): { ok: true } | { ok: false; error: string } {
  if (!buffer || buffer.length < MIN_AUDIO_BYTES) {
    return {
      ok: false,
      error: `Recording too short (${buffer?.length ?? 0} bytes). Hold mic for at least 2 seconds and speak clearly.`,
    };
  }

  // WebM/Matroska magic: 0x1A 0x45 0xDF 0xA3
  const isWebm =
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3;
  const isWav =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46; // RIFF

  if (!isWebm && !isWav && buffer.length < 5000) {
    return {
      ok: false,
      error: 'Invalid audio format. Please try again — hold the mic button longer while speaking.',
    };
  }

  return { ok: true };
}
