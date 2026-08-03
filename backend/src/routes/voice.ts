import { Router } from 'express';
import multer from 'multer';
import { hasGcpCredentials } from '../services/gcp.js';
import { hasGroqKey } from '../services/groq.js';
import {
  generatePipelineAnswer,
  processTranscript,
} from '../services/pipeline.js';
import { hasAnyLlmKey } from '../services/rag.js';
import {
  createSession,
  endSession,
  getSession,
  touchSession,
} from '../services/session.js';
import { getSttProvider, transcribeAudioAuto } from '../services/stt-router.js';
import { normalizeMimeType, validateAudioBuffer } from '../services/audio-utils.js';
import { synthesizeSpeech } from '../services/tts.js';
import type { VoiceProcessResponse } from '../types.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

async function buildVoiceResponse(
  result: Awaited<ReturnType<typeof generatePipelineAnswer>>,
  sessionId: string,
  skipTts: boolean,
): Promise<VoiceProcessResponse> {
  let audio = '';

  if (!skipTts && hasGcpCredentials()) {
    try {
      const audioBuf = await synthesizeSpeech(result.text, result.responseLang);
      audio = audioBuf.toString('base64');
    } catch (err) {
      console.warn('[TTS] GCP failed, client should use browser TTS:', err);
    }
  }

  return {
    type: result.type,
    text: result.text,
    audio,
    sessionId,
    transcript: result.transcript,
    intent: result.intent,
    reason: result.reason,
    sources: result.sources,
    ttsMode: audio ? 'gcp' : 'browser',
    responseLang: result.responseLang,
  };
}

router.post('/session', (_req, res) => {
  const session = createSession();
  res.json({ sessionId: session.id });
});

router.delete('/session/:id', (req, res) => {
  endSession(req.params.id);
  res.json({ ok: true });
});

/**
 * Audio pipeline — GCP STT or Groq Whisper (no browser STT needed).
 * Record in browser → send webm → server transcribes → pipeline → response.
 */
router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    const sttProvider = getSttProvider();
    if (!sttProvider) {
      res.status(503).json({
        error: 'No server STT configured',
        hint: 'Add GROQ_API_KEY (free at console.groq.com) or GCP credentials',
        useBrowserFallback: true,
      });
      return;
    }

    let sessionId = (req.body.sessionId as string) || '';
    if (!sessionId || !getSession(sessionId)) {
      sessionId = createSession().id;
    } else {
      touchSession(sessionId);
    }

    if (!req.file?.buffer) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    const audioCheck = validateAudioBuffer(req.file.buffer);
    if (!audioCheck.ok) {
      res.status(400).json({ error: audioCheck.error, code: 'AUDIO_TOO_SHORT' });
      return;
    }

    const languageCode = (req.body.languageCode as string) || 'auto';
    const mimeType = normalizeMimeType(req.file.mimetype);

    const { transcript, confidence, language, provider } =
      await transcribeAudioAuto(req.file.buffer, {
        languageCode,
        mimeType,
      });

    let result = processTranscript({
      text: transcript,
      sessionId,
      sttConfidence: confidence,
      sttLanguage: language,
    });

    if (result.type === 'answer') {
      result = await generatePipelineAnswer(result, transcript);
    }

    const skipTts = !hasGcpCredentials();
    const payload = await buildVoiceResponse(result, sessionId, skipTts);
    res.json({ ...payload, sttProvider: provider });
  } catch (err) {
    console.error('[voice/process]', err);
    const message =
      err instanceof Error ? err.message : 'Processing failed';
    const isAudioError =
      message.includes('too short') ||
      message.includes('Could not read audio') ||
      message.includes('valid media');
    res.status(isAudioError ? 400 : 500).json({
      error: message,
      useBrowserFallback: !isAudioError && !hasGroqKey(),
      code: isAudioError ? 'AUDIO_INVALID' : undefined,
    });
  }
});

router.post('/text', async (req, res) => {
  try {
    const { text, sessionId: existingId, skipTts, languageCode } = req.body as {
      text?: string;
      sessionId?: string;
      skipTts?: boolean;
      languageCode?: string;
    };

    if (!text?.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    let sessionId = existingId ?? '';
    if (!sessionId || !getSession(sessionId)) {
      sessionId = createSession().id;
    } else {
      touchSession(sessionId);
    }

    let result = processTranscript({
      text,
      sessionId,
      sttLanguage: languageCode ?? 'auto',
    });
    if (result.type === 'answer') {
      result = await generatePipelineAnswer(result, text);
    }

    const payload = await buildVoiceResponse(
      result,
      sessionId,
      skipTts === true || !hasGcpCredentials(),
    );
    res.json(payload);
  } catch (err) {
    console.error('[voice/text]', err);
    res.status(500).json({ error: 'Processing failed' });
  }
});

export default router;
