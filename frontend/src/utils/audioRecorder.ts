/** Minimum recording duration before stop is accepted (ms) */
export const MIN_RECORD_MS = 1500;

export function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

export interface RecordingSession {
  stop: () => void;
  cancel: () => void;
}

/**
 * Record mic audio with periodic chunks so webm is valid when stopped.
 * Returns a blob on stop() if duration >= MIN_RECORD_MS.
 */
export function startMicRecording(
  onTooShort: () => void,
): Promise<{ session: RecordingSession; blob: Promise<Blob> }> {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        const mimeType = getSupportedMimeType();
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        const startedAt = Date.now();
        let stopped = false;

        let resolveBlob!: (b: Blob) => void;
        let rejectBlob!: (e: Error) => void;
        const blobPromise = new Promise<Blob>((res, rej) => {
          resolveBlob = res;
          rejectBlob = rej;
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const elapsed = Date.now() - startedAt;
          const blob = new Blob(chunks, { type: mimeType.split(';')[0] });

          if (elapsed < MIN_RECORD_MS || blob.size < 1000) {
            onTooShort();
            rejectBlob(
              new Error(
                'Recording too short. Hold the mic button for at least 2 seconds while speaking.',
              ),
            );
            return;
          }
          resolveBlob(blob);
        };

        recorder.onerror = () => {
          stream.getTracks().forEach((t) => t.stop());
          rejectBlob(new Error('Recording failed'));
        };

        // timeslice ensures chunks are written before stop
        recorder.start(250);

        const session: RecordingSession = {
          stop: () => {
            if (stopped) return;
            stopped = true;
            if (recorder.state === 'recording') recorder.stop();
          },
          cancel: () => {
            stopped = true;
            if (recorder.state === 'recording') recorder.stop();
            stream.getTracks().forEach((t) => t.stop());
            rejectBlob(new Error('Recording cancelled'));
          },
        };

        resolve({ session, blob: blobPromise });
      })
      .catch(() => reject(new Error('Microphone access denied. Allow mic permission.')));
  });
}
