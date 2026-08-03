import type { LanguageCode } from '../types';

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'auto', label: '🌐 Auto' },
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'en-IN', label: 'English' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ' },
];

interface LanguageSelectorProps {
  value: LanguageCode;
  onChange: (lang: LanguageCode) => void;
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <div className="w-full max-w-md">
      <p className="mb-2 text-center text-xs text-teal-400/70">
        ભાષા / भाषा / Language — <strong>Auto</strong> detects from your speech
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value === lang.code
                ? 'bg-teal-600 text-white'
                : 'bg-teal-950/60 text-teal-300 hover:text-white'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
