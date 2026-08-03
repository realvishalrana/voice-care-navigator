import { Mic, Square } from 'lucide-react';

interface VoiceButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  disabled?: boolean;
  browserMode?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceButton({
  isRecording,
  isProcessing,
  disabled,
  browserMode,
  onStart,
  onStop,
}: VoiceButtonProps) {
  const busy = isProcessing || disabled;

  return (
    <div className="relative flex items-center justify-center">
      {isRecording && (
        <span className="absolute h-28 w-28 rounded-full bg-teal-400/30 animate-pulse-ring" />
      )}
      <button
        type="button"
        disabled={busy}
        onClick={browserMode ? (isRecording ? onStop : onStart) : undefined}
        onPointerDown={!browserMode && !isRecording && !busy ? onStart : undefined}
        onPointerUp={!browserMode && isRecording ? onStop : undefined}
        onPointerLeave={!browserMode && isRecording ? onStop : undefined}
        className={`
          relative z-10 flex h-24 w-24 items-center justify-center rounded-full
          shadow-lg transition-all duration-200 select-none touch-none
          ${isRecording
            ? 'bg-red-600 scale-110 shadow-red-900/50'
            : busy
              ? 'bg-teal-800 opacity-60 cursor-not-allowed'
              : 'bg-teal-600 hover:bg-teal-500 active:scale-95 shadow-teal-900/40'
          }
        `}
        aria-label={isRecording ? 'Stop recording' : 'Hold to speak'}
      >
        {isRecording ? (
          <Square className="h-8 w-8 fill-white text-white" />
        ) : (
          <Mic className="h-10 w-10 text-white" />
        )}
      </button>
    </div>
  );
}
