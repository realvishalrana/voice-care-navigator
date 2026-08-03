import { Loader2, Mic, Cloud, Smartphone, Zap } from 'lucide-react';
import { LanguageSelector } from './components/LanguageSelector';
import { ResponseDisplay } from './components/ResponseDisplay';
import { VoiceButton } from './components/VoiceButton';
import { useVoiceSession } from './hooks/useVoiceSession';
import { isSecureContextForStt } from './utils/browserSpeech';
import { DEMO_PROMPTS, VOICE_MODE_LABELS, type LanguageCode, type VoiceMode } from './types';
import { useState } from 'react';

export default function App() {
  const [language, setLanguage] = useState<LanguageCode>('auto');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('auto');
  const {
    isRecording,
    isProcessing,
    isPlaying,
    response,
    error,
    interimTranscript,
    recordingMode,
    health,
    backendOnline,
    retryBackend,
    browserSttSupported,
    startRecording,
    stopRecording,
    sendText,
    replayAnswer,
  } = useVoiceSession(language, voiceMode);

  const isServerMode = recordingMode === 'server';
  const sttLabel =
    health?.capabilities?.stt === 'groq'
      ? 'Groq Whisper'
      : health?.capabilities?.stt === 'gcp'
        ? 'Google STT'
        : 'Browser STT';

  return (
    <div className="flex min-h-full flex-col items-center px-4 py-6">
      <header className="mb-6 w-full max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-teal-400">
          Medtronic Labs · VDA
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">स्वास्थ्य सहायक</h1>
        <p className="mt-1 text-sm text-teal-300/80">
          बोलकर पूछें — पढ़ने की ज़रूरत नहीं
        </p>
      </header>

      {backendOnline === false && (
        <div className="mb-4 w-full max-w-md rounded-xl border border-red-500/50 bg-red-950/60 p-4 text-sm text-red-100">
          <p className="font-semibold">⚠️ Backend not connected</p>
          <code className="mt-2 block rounded bg-black/30 p-2 text-xs">
            cd vda-assistant/backend && npm run dev
          </code>
          <button
            type="button"
            onClick={() => void retryBackend()}
            className="mt-2 text-xs underline text-red-200"
          >
            Retry connection
          </button>
        </div>
      )}

      {backendOnline === true && (
        <div className="mb-2 text-xs text-teal-400">● Backend connected</div>
      )}

      <div className="mb-4 flex flex-col items-center gap-3">
        <LanguageSelector value={language} onChange={setLanguage} />

        <div className="flex flex-wrap justify-center gap-1 rounded-full bg-teal-950/60 p-1">
          {(['auto', 'groq', 'gcp', 'browser'] as VoiceMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setVoiceMode(mode)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                voiceMode === mode
                  ? 'bg-teal-600 text-white'
                  : 'text-teal-300 hover:text-white'
              }`}
            >
              {VOICE_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
            isServerMode && health?.capabilities?.stt === 'groq'
              ? 'bg-violet-950/50 text-violet-200'
              : isServerMode
                ? 'bg-teal-900/50 text-teal-300'
                : 'bg-amber-950/50 text-amber-200'
          }`}
        >
          {isServerMode && health?.capabilities?.stt === 'groq' ? (
            <>
              <Zap className="h-3.5 w-3.5" />
              Groq mode · {sttLabel} + browser TTS
            </>
          ) : isServerMode ? (
            <>
              <Cloud className="h-3.5 w-3.5" />
              Server mode · {sttLabel}
            </>
          ) : (
            <>
              <Smartphone className="h-3.5 w-3.5" />
              Browser mode · Web Speech API
            </>
          )}
        </div>

        {health && !health.groq && !health.gcpCredentials && (
          <p className="max-w-xs text-center text-xs text-amber-300">
            Add <strong>GROQ_API_KEY</strong> to backend/.env for reliable voice (free at console.groq.com)
          </p>
        )}
        {!browserSttSupported && !isServerMode && (
          <p className="text-xs text-amber-300">Use Chrome/Edge or enable Groq mode</p>
        )}
        {recordingMode === 'browser' && !isSecureContextForStt() && (
          <p className="text-xs text-amber-300">Use http://localhost:5173 for voice</p>
        )}
      </div>

      <main className="flex w-full max-w-md flex-1 flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <VoiceButton
            isRecording={isRecording}
            isProcessing={isProcessing}
            disabled={backendOnline === false}
            onStart={startRecording}
            onStop={stopRecording}
            browserMode={!isServerMode}
          />
          <p className="text-sm text-teal-300/80">
            {isRecording
              ? isServerMode
                ? 'बोलते रहें… कम से कम 2 सेकंड (Hold 2+ seconds)'
                : 'बोलें… दोबारा टैप करें'
              : isProcessing
                ? 'प्रोसेस हो रहा है…'
                : isServerMode
                  ? 'दबाकर रखें और बोलें'
                  : 'टैप करें और बोलें'}
          </p>
          {interimTranscript && (
            <p className="text-sm italic text-teal-400/70">
              सुन रहा है: &ldquo;{interimTranscript}&rdquo;
            </p>
          )}
          {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-teal-400" />}
        </div>

        {error && (
          <div className="w-full rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <ResponseDisplay
          response={response}
          isPlaying={isPlaying}
          onReplay={() => void replayAnswer()}
        />

        <section className="w-full">
          <p className="mb-2 flex items-center justify-center gap-1 text-center text-xs text-teal-400/70">
            <Mic className="h-3 w-3" />
            डेमो प्रश्न
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_PROMPTS.map((prompt) => (
              <button
                key={prompt.text}
                type="button"
                disabled={isProcessing || isRecording}
                onClick={() => void sendText(prompt.text)}
                className="rounded-xl border border-teal-700/50 bg-teal-950/40 px-3 py-2 text-left text-sm text-teal-100 transition hover:bg-teal-800/50 disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-8 text-center text-xs text-teal-500/60">
        UC1 दवाई · UC2 योजना · UC3 अस्पताल · UC4 सलाह
        {health && (
          <span className="block mt-1">
            STT: {health.capabilities?.stt ?? '?'} · LLM: {health.capabilities?.llm ?? '?'}
          </span>
        )}
      </footer>
    </div>
  );
}
