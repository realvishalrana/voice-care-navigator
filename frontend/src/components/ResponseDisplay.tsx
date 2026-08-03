import { AlertTriangle, HelpCircle, MessageCircle, ShieldAlert, Volume2 } from 'lucide-react';
import type { VoiceResponse } from '../types';

interface ResponseDisplayProps {
  response: VoiceResponse | null;
  isPlaying: boolean;
  onReplay?: () => void;
}

const TYPE_CONFIG = {
  answer: { icon: MessageCircle, border: 'border-teal-500/40', bg: 'bg-teal-900/50', label: 'જવાબ / जवाब' },
  escalation: { icon: ShieldAlert, border: 'border-red-500/60', bg: 'bg-red-950/60', label: 'આપાતકાલીન' },
  fallback: { icon: HelpCircle, border: 'border-amber-500/40', bg: 'bg-amber-950/40', label: 'સમજાયું નહીં' },
  out_of_scope: { icon: AlertTriangle, border: 'border-amber-500/40', bg: 'bg-amber-950/40', label: 'સીમા બહાર' },
};

export function ResponseDisplay({ response, isPlaying, onReplay }: ResponseDisplayProps) {
  if (!response) return null;

  const config = TYPE_CONFIG[response.type];
  const Icon = config.icon;

  return (
    <div
      className={`animate-fade-in-up w-full rounded-2xl border p-4 ${config.border} ${config.bg}`}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon
          className={`h-5 w-5 shrink-0 ${response.type === 'escalation' ? 'text-red-400' : 'text-teal-300'}`}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-teal-300">
          {config.label}
        </span>
        {isPlaying && (
          <span className="ml-auto text-xs text-teal-400 animate-pulse">🔊 બોલી રહ્યું છે…</span>
        )}
      </div>

      {response.transcript && (
        <p className="mb-2 text-sm text-teal-300/70">
          You said: &ldquo;{response.transcript}&rdquo;
        </p>
      )}

      <p
        className={`text-base leading-relaxed ${
          response.type === 'escalation' ? 'font-semibold text-red-100' : 'text-teal-50'
        }`}
      >
        {response.text}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {onReplay && response.text && (
          <button
            type="button"
            onClick={onReplay}
            disabled={isPlaying}
            className="inline-flex items-center gap-2 rounded-xl border border-teal-600/50 bg-teal-800/40 px-4 py-2 text-sm font-medium text-teal-100 transition hover:bg-teal-700/50 disabled:opacity-50"
          >
            <Volume2 className="h-4 w-4" />
            ફરીથી સાંભળો / सुनें फिर से
          </button>
        )}

        {response.ttsFallback && (
          <p className="text-xs text-amber-300/80 self-center">
            Voice fallback — text shown in your language
          </p>
        )}
      </div>

      {response.type === 'escalation' && (
        <a
          href="tel:108"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
        >
          📞 108
        </a>
      )}
    </div>
  );
}
