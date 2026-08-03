import type { LanguageCode } from './language.js';
import type { IntentResult, UseCase } from '../types.js';

const CONFIDENCE_THRESHOLD = 0.3;

interface UseCaseRule {
  useCase: UseCase;
  keywords: string[];
  weight: number;
}

const USE_CASE_RULES: UseCaseRule[] = [
  {
    useCase: 'UC1',
    weight: 1,
    keywords: [
      'dawai', 'medicine', 'dava', 'tablet', 'दवाई', 'दवा', 'દવા',
      'reminder', 'yaad', 'भूल', 'forget', 'dose', 'schedule', 'कब ले', 'ક્યારે',
      'follow up', 'follow-up', 'followup', 'checkup', 'जांच', 'screening', 'सालाना',
      'फॉलो', 'ફોલો', 'આગામી',
      'salt', 'diet', 'exercise', 'व्यायाम', 'bp medicine', 'adherence',
      'नमक', 'खाना', 'sugar', 'shugar', 'शुगर', 'diabetes', 'मधुमेह',
      'blood sugar', 'ब्लड शुगर', 'चेक', 'check', 'glucose', 'insulin',
      'ડાયાબિટીસ', 'ಮಧುಮೇಹ', 'சர்க்கரை', 'షుగర్',
    ],
  },
  {
    useCase: 'UC2',
    weight: 1,
    keywords: [
      'pmjay', 'pm-jay', 'ayushman', 'आयुष्मान', 'scheme', 'योजना',
      'eligible', 'eligibility', 'योग्य', 'पात्र', 'free treatment',
      'मुफ्त', 'card', 'कार्ड', 'enroll', 'register', 'पंजीकरण',
      '5 lakh', 'coverage', 'benefit', 'लाभ', 'યોજના', 'ಯೋಜನೆ',
    ],
  },
  {
    useCase: 'UC3',
    weight: 1,
    keywords: [
      'hospital', 'phc', 'chc', 'facility', 'center', 'centre',
      'अस्पताल', 'केंद्र', 'where', 'near', 'नजदीक', 'ક્યાં', 'નજીક', 'કહાં',
      'कहाँ', 'कहां', 'location',
      'mandir', 'मंदिर', 'find', 'dhundho', 'खोज', 'referral', 'रेफरल',
      'जाना है', 'जाना', 'कहाँ जाएं', 'कहां जाएं', 'कहाँ जाना', 'कहां जाना',
      'અસ્પતાલ', 'હોસ્પિટલ', 'ಸರ್ಕಾರಿ', 'ಆಸ್ಪತ್ರೆ', 'ஆஸ்பத்திரி', 'ఆసుపత్రి',
    ],
  },
  {
    useCase: 'UC4',
    weight: 1,
    keywords: [
      'teleconsult', 'video', 'call doctor', 'डॉक्टर से बात',
      'consult', 'सलाह', 'advice', 'esanjeevani', 'e-sanjeevani',
      'mild', 'thoda', 'थोड़ा', 'question', 'सवाल', 'talk', 'વાત કરવી', 'વાત',
      // Hindi symptoms / guidance
      'माथा', 'सिर', 'सिरदर्द', 'सिर दर्द', 'दर्द', 'क्या करूं', 'क्या करें',
      'तकलीफ', 'बीमार', 'असहज',
      // Gujarati
      'માથું', 'દુખે', 'શું કરી', 'કરી શકું', 'સલાહ', 'ડોક્ટર', 'તાબીયત', 'દર્દ', 'બિમાર',
      // Kannada
      'ತಲೆ', 'ನೋವು', 'ಏನು ಮಾಡ', 'ಮಾಡಬೇಕು', 'ನೋವಿಸುತ್ತಿದೆ',
      // Tamil
      'தலை', 'வலி', 'என்ன செய்ய', 'மருத்துவர்',
      // Telugu
      'తల', 'నొప్పి', 'ఏం చేయాలి',
      // English
      'headache', 'head ache', 'head hurt', 'what should i', 'what can i do',
      'feel sick', 'not feeling well', 'body pain',
    ],
  },
];

const OUT_OF_SCOPE_KEYWORDS = [
  'weather', 'cricket', 'movie', 'recipe', 'joke', 'news',
  'मौसम', 'फिल्म', 'खाना बनाना',
];

/** Catch regional-language health questions that keyword rules miss */
function detectRegionalHealthQuestion(text: string): IntentResult | null {
  const symptomSignals = [
    'દુખે', 'દર્દ', 'માથું', 'दर्द', 'माथा', 'सिर', 'ನೋವು', 'ತಲೆ',
    'வலி', 'தலை', 'నొప్పి', 'తల', 'hurt', 'pain', 'ache', 'sick', 'બિમાર',
  ];
  const questionSignals = [
    'શું કરી', 'કરી શકું', 'क्या करूं', 'what can i', 'what should i',
    'ಏನು ಮಾಡ', 'என்ன செய்ய', 'ఏం చేయాలి',
  ];

  const matchedSymptoms = symptomSignals.filter((s) => text.includes(s));
  const matchedQuestions = questionSignals.filter((s) => text.includes(s));

  if (matchedSymptoms.length > 0) {
    return {
      useCase: 'UC4',
      confidence: Math.min(0.7 + matchedSymptoms.length * 0.1, 0.92),
      matchedKeywords: matchedSymptoms,
    };
  }
  if (matchedQuestions.length > 0) {
    return {
      useCase: 'UC4',
      confidence: 0.6,
      matchedKeywords: matchedQuestions,
    };
  }
  return null;
}

export function classifyIntent(transcript: string): IntentResult {
  const text = transcript.toLowerCase().trim();

  if (!text) {
    return { useCase: 'UC1', confidence: 0, matchedKeywords: [] };
  }

  for (const kw of OUT_OF_SCOPE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      return { useCase: 'UC1', confidence: 0, matchedKeywords: [kw] };
    }
  }

  const scores: Record<UseCase, { score: number; matched: string[] }> = {
    UC1: { score: 0, matched: [] },
    UC2: { score: 0, matched: [] },
    UC3: { score: 0, matched: [] },
    UC4: { score: 0, matched: [] },
  };

  for (const rule of USE_CASE_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) {
        scores[rule.useCase].score += rule.weight;
        scores[rule.useCase].matched.push(kw);
      }
    }
  }

  const ranked = (Object.entries(scores) as [UseCase, { score: number; matched: string[] }][])
    .sort((a, b) => b[1].score - a[1].score);

  const [topUseCase, top] = ranked[0];
  const [, second] = ranked[1];

  if (top.score === 0) {
    const regional = detectRegionalHealthQuestion(transcript);
    if (regional) return regional;
    return { useCase: topUseCase, confidence: 0, matchedKeywords: [] };
  }

  const totalScore = ranked.reduce((s, [, v]) => s + v.score, 0);
  let confidence = top.score / totalScore;

  // Only penalize if very close tie (same score)
  if (second.score > 0 && top.score === second.score) {
    confidence *= 0.7;
  }

  confidence = Math.min(confidence, 0.95);

  return {
    useCase: topUseCase,
    confidence,
    matchedKeywords: top.matched,
  };
}

export function isLowConfidence(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLD;
}

const OUT_OF_SCOPE: Partial<Record<LanguageCode, string>> & { default: string } = {
  default:
    'मैं केवल दवाई, सरकारी योजना, अस्पताल खोजने और स्वास्थ्य सलाह में मदद कर सकता हूं।',
  'hi-IN':
    'मैं केवल दवाई, सरकारी योजना, अस्पताल खोजने और स्वास्थ्य सलाह में मदद कर सकता हूं।',
  'en-IN':
    'I can only help with medicines, government schemes, finding hospitals, and health guidance.',
  'gu-IN':
    'હું ફક્ત દવા, સરકારી યોજના, હોસ્પિટલ શોધવા અને આરોગ્ય સલાહમાં મદદ કરી શકું છું.',
  'kn-IN':
    'ನಾನು ಔಷಧಿ, ಸರ್ಕಾರಿ ಯೋಜನೆ, ಆಸ್ಪತ್ರೆ ಹುಡುಕುವಿಕೆ ಮತ್ತು ಆರೋಗ್ಯ ಸಲಹೆಯಲ್ಲಿ ಮಾತ್ರ ಸಹಾಯ ಮಾಡಬಹುದು.',
  'ta-IN':
    'மருந்து, அரசு திட்டம், மருத்துவமனை தேடல் மற்றும் சுகாதார வழிகாட்டுதலில் மட்டுமே நான் உதவ முடியும்.',
  'te-IN':
    'నేను మందులు, ప్రభుత్వ పథకం, ఆసుపత్రి వెతకడం మరియు ఆరోగ్య సలహాలో మాత్రమే సహాయం చేయగలను.',
  'mr-IN':
    'मी फक्त औषधे, सरकारी योजना, रुग्णालय शोधणे आणि आरोग्य सल्ल्यात मदत करू शकतो.',
  'bn-IN':
    'আমি শুধুমাত্র ওষুধ, সরকারি প্রকল্প, হাসপাতাল খোঁজা এবং স্বাস্থ্য পরামর্শে সাহায্য করতে পারি।',
};

const FALLBACK: Partial<Record<LanguageCode, string>> & { default: string } = {
  default: 'मुझे समझ नहीं आया। कृपया दोबारा बोलें या अपने स्वास्थ्य केंद्र पर संपर्क करें।',
  'hi-IN': 'मुझे समझ नहीं आया। कृपया दोबारा बोलें या अपने स्वास्थ्य केंद्र पर संपर्क करें।',
  'en-IN': "I didn't understand. Please speak again or contact your health center.",
  'gu-IN': 'મને સમજાયું નહીં. કૃપા કરીને ફરીથી બોલો અથવા તમારા આરોગ્ય કેન્દ્રનો સંપર્ક કરો.',
  'kn-IN': 'ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಮಾತನಾಡಿ ಅಥವಾ ನಿಮ್ಮ ಆರೋಗ್ಯ ಕೇಂದ್ರವನ್ನು ಸಂಪರ್ಕಿಸಿ.',
};

export function getOutOfScopeMessage(lang: string): string {
  return OUT_OF_SCOPE[lang as LanguageCode] ?? OUT_OF_SCOPE.default;
}

export function getFallbackMessage(lang: string): string {
  return FALLBACK[lang as LanguageCode] ?? FALLBACK.default;
}

/** @deprecated use getOutOfScopeMessage */
export const MESSAGES = {
  fallbackHi: FALLBACK['hi-IN']!,
  fallbackEn: FALLBACK['en-IN']!,
  outOfScopeHi: OUT_OF_SCOPE['hi-IN']!,
  outOfScopeEn: OUT_OF_SCOPE['en-IN']!,
};
