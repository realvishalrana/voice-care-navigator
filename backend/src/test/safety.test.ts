/**
 * Safety + intent tests — run: npx tsx backend/src/test/safety.test.ts
 */
import { checkSafety, getEscalationMessage } from '../services/safety.js';
import { classifyIntent, isLowConfidence } from '../services/intent.js';
import { detectLanguage } from '../services/language.js';

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

console.log('\n=== Safety Gate Tests (must escalate) ===\n');

const mustEscalate = [
  'मुझे सीने में दर्द है',
  'मुझे सीने में बहुत तेज दर्द हो रहा है',
  'I have chest pain',
  'मुझे chest pen हो रहा है',
  'शुगर चेक करवाने कहां जाना है और मुझे chest pen हो रहा है',
  'सांस नहीं आ रही',
  'cannot breathe properly',
  'अचानक कमजोरी एक तरफ',
  'बेहोश हो गया',
];

for (const text of mustEscalate) {
  const result = checkSafety(text);
  assert(`escalate: "${text.slice(0, 45)}..."`, result.escalate === true);
}

console.log('\n=== Safety Gate Tests (must NOT escalate) ===\n');

const mustNotEscalate = [
  'मेरी दवाई कब लेनी है',
  'शुगर चेक करवाने कहां जाना है',
  'PM-JAY eligibility check',
  'नजदीकी hospital कहाँ है',
];

for (const text of mustNotEscalate) {
  const result = checkSafety(text);
  assert(`no escalate: "${text.slice(0, 40)}..."`, result.escalate === false);
}

console.log('\n=== Intent Tests ===\n');

const sugarCheck = classifyIntent('शुगर चेक करवाने कहां जाना है');
assert(
  'sugar check → UC1 or UC3 (not out of scope)',
  !isLowConfidence(sugarCheck.confidence),
);

const uc1 = classifyIntent('मेरी दवाई कब लेनी है');
assert('UC1 adherence', uc1.useCase === 'UC1' && !isLowConfidence(uc1.confidence));

console.log('\n=== Language Detection ===\n');

assert('Hindi detected', detectLanguage('मेरी दवाई कब लेनी है') === 'hi-IN');
assert('English detected', detectLanguage('where is nearest hospital') === 'en-IN');
const uc4gujarati = classifyIntent('મારું માથું દુખે છે હું શું કરી શકું છું');
assert(
  'Gujarati headache → UC4',
  uc4gujarati.useCase === 'UC4' && !isLowConfidence(uc4gujarati.confidence),
);

assert(
  'Gujarati script detected',
  detectLanguage('મારું માથું દુખે છે', 'auto') === 'gu-IN',
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
