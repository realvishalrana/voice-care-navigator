import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  HealthStatus,
  LanguageCode,
  SpeakLanguageCode,
  VoiceMode,
  VoiceResponse,
} from '../types';
import {
  isBrowserSttSupported,
  speakWithBrowserTts,
  startBrowserStt,
  stopBrowserTts,
  warmupBrowserVoices,
  type BrowserSttResult,
} from '../utils/browserSpeech';
import { startMicRecording, type RecordingSession } from '../utils/audioRecorder';

const API_BASE = '/api/voice';

function resolveRecordingMode(
  requested: VoiceMode,
  health: HealthStatus | null,
): 'server' | 'browser' {
  if (requested === 'browser') return 'browser';
  if (health?.capabilities?.serverStt) return 'server';
  return 'browser';
}

function toSpeakLang(code?: string, fallback: SpeakLanguageCode = 'hi-IN'): SpeakLanguageCode {
  const valid: SpeakLanguageCode[] = [
    'hi-IN', 'en-IN', 'gu-IN', 'kn-IN', 'ta-IN', 'te-IN', 'mr-IN', 'bn-IN', 'pa-IN', 'or-IN',
  ];
  if (code && valid.includes(code as SpeakLanguageCode)) {
    return code as SpeakLanguageCode;
  }
  return fallback;
}

export function useVoiceSession(languageCode: LanguageCode, voiceMode: VoiceMode = 'auto') {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recordingMode, setRecordingMode] = useState<'server' | 'browser'>('server');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<VoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const micSessionRef = useRef<RecordingSession | null>(null);
  const blobPromiseRef = useRef<Promise<Blob> | null>(null);
  const recordStartedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserSttStopRef = useRef<(() => void) | null>(null);
  const browserSttResultRef = useRef<Promise<BrowserSttResult> | null>(null);
  const lastSpeakLangRef = useRef<SpeakLanguageCode>('hi-IN');

  const checkBackend = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/health', { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error('health failed');
      const data = (await res.json()) as HealthStatus;
      setHealth(data);
      setBackendOnline(true);
      setRecordingMode(resolveRecordingMode(voiceMode, data));
      return true;
    } catch {
      setBackendOnline(false);
      setHealth(null);
      return false;
    }
  }, [voiceMode]);

  useEffect(() => {
    warmupBrowserVoices();
    void checkBackend();
    const interval = setInterval(() => void checkBackend(), 10000);

    fetch(`${API_BASE}/session`, { method: 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { sessionId: string }) => setSessionId(data.sessionId))
      .catch(() => {});

    return () => {
      clearInterval(interval);
      micSessionRef.current?.cancel();
      stopBrowserTts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRecordingMode(resolveRecordingMode(voiceMode, health));
  }, [voiceMode, health]);

  const playGcpAudio = useCallback((base64: string) => {
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audioRef.current = audio;
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    void audio.play();
  }, []);

  const speakText = useCallback(
    async (text: string, lang: SpeakLanguageCode): Promise<boolean> => {
      lastSpeakLangRef.current = lang;
      const result = await speakWithBrowserTts(text, lang);
      return result.ok;
    },
    [],
  );

  const playResponse = useCallback(
    async (data: VoiceResponse): Promise<void> => {
      const speakLang = toSpeakLang(
        data.responseLang,
        languageCode === 'auto' ? 'hi-IN' : toSpeakLang(languageCode),
      );

      if (data.audio && data.ttsMode !== 'browser') {
        playGcpAudio(data.audio);
        return;
      }

      setIsPlaying(true);
      const ok = await speakText(data.text, speakLang);
      setIsPlaying(false);

      if (!ok) {
        setResponse((prev) => (prev ? { ...prev, ttsFallback: true } : prev));
      }
    },
    [languageCode, playGcpAudio, speakText],
  );

  const replayAnswer = useCallback(async () => {
    if (!response?.text) return;
    setIsPlaying(true);
    const lang = toSpeakLang(response.responseLang, lastSpeakLangRef.current);
    await speakText(response.text, lang);
    setIsPlaying(false);
  }, [response, speakText]);

  const sendTextToBackend = useCallback(
    async (text: string) => {
      const res = await fetch(`${API_BASE}/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sessionId,
          skipTts: !health?.capabilities?.gcp,
          languageCode,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Request failed');
      }

      const data = (await res.json()) as VoiceResponse;
      if (data.sessionId) setSessionId(data.sessionId);
      setResponse(data);
      await playResponse(data);
    },
    [sessionId, playResponse, health, languageCode],
  );

  const processAudioBlob = useCallback(
    async (blob: Blob) => {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('languageCode', languageCode);
      if (sessionId) formData.append('sessionId', sessionId);

      const res = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const body = err as { error?: string; useBrowserFallback?: boolean };
        if (body.useBrowserFallback) throw new Error('SERVER_STT_UNAVAILABLE');
        throw new Error(body.error ?? 'Request failed');
      }

      const data = (await res.json()) as VoiceResponse;
      if (data.sessionId) setSessionId(data.sessionId);
      setResponse(data);
      await playResponse(data);
    },
    [languageCode, sessionId, playResponse],
  );

  const startServerRecording = useCallback(async () => {
    if (backendOnline === false) {
      setError('Start backend: cd vda-assistant/backend && npm run dev');
      return;
    }
    setError(null);
    setResponse(null);
    try {
      const { session, blob } = await startMicRecording(() => {
        setError('Hold mic longer — speak for at least 2 seconds.');
      });
      micSessionRef.current = session;
      blobPromiseRef.current = blob;
      recordStartedAtRef.current = Date.now();
      setIsRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Microphone access denied.');
    }
  }, [backendOnline]);

  const stopServerRecording = useCallback(async () => {
    const session = micSessionRef.current;
    const blobPromise = blobPromiseRef.current;
    if (!session || !blobPromise) return;

    const heldMs = Date.now() - recordStartedAtRef.current;
    if (heldMs < 1500) {
      session.cancel();
      micSessionRef.current = null;
      blobPromiseRef.current = null;
      setIsRecording(false);
      setError('Hold mic for at least 2 seconds while speaking.');
      return;
    }

    session.stop();
    micSessionRef.current = null;
    blobPromiseRef.current = null;
    setIsRecording(false);
    setIsProcessing(true);

    try {
      const audioBlob = await blobPromise;
      await processAudioBlob(audioBlob);
    } catch (e) {
      if (e instanceof Error && e.message === 'SERVER_STT_UNAVAILABLE') {
        setError('Add GROQ_API_KEY to backend/.env and restart backend.');
      } else {
        setError(e instanceof Error ? e.message : 'Processing failed');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [processAudioBlob]);

  const startBrowserRecording = useCallback(() => {
    if (backendOnline === false) {
      setError('Start backend first.');
      return;
    }
    if (!isBrowserSttSupported()) {
      setError('Use Groq mode or Chrome/Edge.');
      return;
    }

    setError(null);
    setResponse(null);
    setInterimTranscript('');

    const sttLang = languageCode === 'auto' ? 'hi-IN' : languageCode;
    const { session, result } = startBrowserStt(sttLang, setInterimTranscript);
    browserSttStopRef.current = session.stop;
    browserSttResultRef.current = result;
    setIsRecording(true);
  }, [languageCode, backendOnline]);

  const stopBrowserRecording = useCallback(async () => {
    const stopFn = browserSttStopRef.current;
    const resultPromise = browserSttResultRef.current;
    if (!stopFn || !resultPromise) return;

    browserSttStopRef.current = null;
    browserSttResultRef.current = null;
    setIsRecording(false);
    setIsProcessing(true);
    stopFn();

    try {
      const { transcript } = await resultPromise;
      setInterimTranscript('');
      await sendTextToBackend(transcript);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speech recognition failed');
    } finally {
      setIsProcessing(false);
      setInterimTranscript('');
    }
  }, [sendTextToBackend]);

  const startRecording = useCallback(() => {
    const mode = resolveRecordingMode(voiceMode, health);
    setRecordingMode(mode);
    if (mode === 'server') void startServerRecording();
    else startBrowserRecording();
  }, [voiceMode, health, startServerRecording, startBrowserRecording]);

  const stopRecording = useCallback(() => {
    if (recordingMode === 'server' && isRecording) {
      void stopServerRecording();
    } else if (recordingMode === 'browser' && isRecording) {
      void stopBrowserRecording();
    }
  }, [recordingMode, isRecording, stopServerRecording, stopBrowserRecording]);

  const sendText = useCallback(
    async (text: string) => {
      setIsProcessing(true);
      setError(null);
      setResponse(null);
      try {
        await sendTextToBackend(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Processing failed');
      } finally {
        setIsProcessing(false);
      }
    },
    [sendTextToBackend],
  );

  return {
    isRecording,
    isProcessing,
    isPlaying,
    response,
    error,
    interimTranscript,
    recordingMode,
    health,
    backendOnline,
    retryBackend: checkBackend,
    browserSttSupported: isBrowserSttSupported(),
    startRecording,
    stopRecording,
    sendText,
    replayAnswer,
  };
}
