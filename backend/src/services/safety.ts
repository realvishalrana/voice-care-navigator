import type { LanguageCode } from './language.js';
import type { SafetyResult } from '../types.js';

/**
 * DETERMINISTIC safety gate — runs BEFORE any LLM call.
 * Patterns use flexible matching (words may appear with text between them).
 * Supports Hindi, English, Hinglish, Gujarati, Kannada, and common STT typos.
 */
const RED_FLAG_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
  action: string;
}> = [
  // Cardiac — flexible: "सीने में बहुत तेज दर्द", "chest pen" (STT typo)
  {
    pattern:
      /chest.{0,12}pain|chest\s*pen|heart\s*attack|दिल\s*का\s*दौरा|दिल\s*में\s*दर्द|छाती\s*में\s*दर्द|सीने\s*में[^.]{0,40}दर्द|सीने\s*में\s*दर्द|seene\s*mein?\s*dard|seene\s*me\s*dard/i,
    reason: 'cardiac_symptoms',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Gujarati chest pain
  {
    pattern: /છાતી\s*માં\s*દુખાવ|છાતી\s*માં\s*દર્દ|સીને\s*માં\s*દર્દ/i,
    reason: 'cardiac_symptoms',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Kannada chest pain
  {
    pattern: /ಎದೆಯ\s*ನೋವು|ಚೇಸ್ಟ್\s*ನೋವು|ಛಾತಿಯ\s*ನೋವು/i,
    reason: 'cardiac_symptoms',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Tamil chest pain
  {
    pattern: /மார்பு\s*வலி|நெஞ்சு\s*வலி/i,
    reason: 'cardiac_symptoms',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Telugu chest pain
  {
    pattern: /ఛాతీ\s*నొప్పి|ఛాతి\s*నొప్పి/i,
    reason: 'cardiac_symptoms',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Respiratory
  {
    pattern:
      /can'?t\s*breathe|cannot\s*breathe|breathless|suffocat|सांस\s*नहीं|सांस\s*नहीं\s*आ|सांस\s*लेने\s*में|saans\s*nahi|घुटन|શ્વાસ\s*નથી|શ્વાસ\s*લેવામાં|ಉಸಿರಾಡಲು\s*ಸಾಧ್ಯವಿಲ್ಲ/i,
    reason: 'respiratory_distress',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Stroke
  {
    pattern:
      /sudden\s*weakness|one\s*side\s*weak|paralysis|अचानक\s*कमजोरी|हाथ\s*सुन्न|पैर\s*सुन्न|लकवा|અચાનક\s*નબળાઈ|ಇದ್ದಾನೆ\s*ದೌರ್ಬಲ್ಯ/i,
    reason: 'stroke_symptoms',
    action: 'CALL_108_IMMEDIATELY',
  },
  {
    pattern:
      /can'?t\s*speak|cannot\s*speak|speech\s*slur|facial\s*droop|बोल\s*नहीं|अचानक\s*बोलना/i,
    reason: 'stroke_symptoms',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Neurological
  {
    pattern:
      /severe\s*headache|worst\s*headache|sudden\s*headache|तेज\s*सिरदर्द|अचानक\s*सिरदर्द|बहुत\s*तेज\s*सिर/i,
    reason: 'neurological_red_flag',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Loss of consciousness
  {
    pattern:
      /unconscious|fainted|collapsed|बेहोश|बेहोशी|गिर\s*गया|गिर\s*गई/i,
    reason: 'loss_of_consciousness',
    action: 'CALL_108_IMMEDIATELY',
  },
  // Bleeding
  {
    pattern: /heavy\s*bleed|severe\s*bleed|खून\s*बह|बहुत\s*खून/i,
    reason: 'hemorrhage',
    action: 'CALL_108_IMMEDIATELY',
  },
];

const ESCALATION_MESSAGES: Partial<Record<LanguageCode, string>> & { default: string } = {
  default:
    'यह गंभीर हो सकता है। तुरंत 108 पर कॉल करें या नजदीकी अस्पताल जाएं। मैं एक स्वास्थ्य कर्मी को सूचित कर रहा हूं।',
  'hi-IN':
    'यह गंभीर हो सकता है। तुरंत 108 पर कॉल करें या नजदीकी अस्पताल जाएं। मैं एक स्वास्थ्य कर्मी को सूचित कर रहा हूं।',
  'en-IN':
    'This could be serious. Call 108 immediately or go to the nearest hospital. I am alerting a health worker.',
  'gu-IN':
    'આ ગંભીર હોઈ શકે છે. તરત જ 108 પર કૉલ કરો અથવા નજીકની હોસ્પિટલમાં જાઓ. હું આરોગ્ય કર્મચારીને સૂચિત કરું છું.',
  'kn-IN':
    'ಇದು ಗಂಭೀರವಾಗಿರಬಹುದು. ತಕ್ಷಣ 108 ಗೆ ಕರೆ ಮಾಡಿ ಅಥವಾ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗೆ ಹೋಗಿ. ನಾನು ಆರೋಗ್ಯ ಕರ್ಮಿಯನ್ನು ಸೂಚಿಸುತ್ತಿದ್ದೇನೆ.',
  'ta-IN':
    'இது தீவிரமாக இருக்கலாம். உடனே 108 க்கு அழைக்கவும் அல்லது அருகிலுள்ள மருத்துவமனைக்கு செல்லவும்.',
  'te-IN':
    'ఇది తీవ్రమైనది కావచ్చు. వెంటనే 108 కు కాల్ చేయండి లేదా సమీప ఆసుపత్రికి వెళ్లండి.',
  'mr-IN':
    'हे गंभीर असू शकते. लगेच 108 वर कॉल करा किंवा जवळच्या रुग्णालयात जा.',
  'bn-IN':
    'এটি গুরুতর হতে পারে। অবিলম্বে 108 এ কল করুন বা নিকটস্থ হাসপাতালে যান।',
};

export function checkSafety(transcript: string): SafetyResult {
  const normalized = transcript.trim();
  if (!normalized) {
    return { escalate: false };
  }

  for (const { pattern, reason, action } of RED_FLAG_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        escalate: true,
        reason,
        action,
        matchedPattern: pattern.source,
      };
    }
  }

  return { escalate: false };
}

export function getEscalationMessage(languageCode?: string): string {
  const code = languageCode as LanguageCode;
  return ESCALATION_MESSAGES[code] ?? ESCALATION_MESSAGES.default;
}

export function alertClinician(
  sessionId: string,
  reason: string,
  transcript: string,
): void {
  console.warn(
    `[ESCALATION ALERT] session=${sessionId} reason=${reason} transcript="${transcript.slice(0, 100)}"`,
  );
}
