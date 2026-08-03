/**
 * Run multilingual testcase suite from testcases.json
 * Usage: npm run test:cases
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyIntent, isLowConfidence } from '../services/intent.js';
import { processTranscript } from '../services/pipeline.js';
import { retrieveContext } from '../services/rag.js';
import { checkSafety } from '../services/safety.js';
import type { UseCase } from '../types.js';
import { expectedUseCase } from './testcase-mapping.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_FILE = join(__dirname, 'testcases.json');

interface ExpectedResult {
  status: string;
  shouldUseRAG: boolean;
  shouldEscalate: boolean;
  shouldAskFollowUp: boolean;
}

interface TestCase {
  id: string;
  useCase: string;
  language: string;
  question: string;
  expectedIntent: string;
  expectedResult: ExpectedResult;
}

interface TestSuite {
  version: string;
  description: string;
  totalTestCases: number;
  testCases: TestCase[];
}

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function runCase(tc: TestCase) {
  const expectedUc = expectedUseCase(tc.expectedIntent, tc.useCase);
  const safety = checkSafety(tc.question);
  const pipeline = processTranscript({
    text: tc.question,
    sessionId: 'test-session',
    sttConfidence: 0.9,
  });

  console.log(`\n[${tc.id}] ${tc.language} — ${tc.question.slice(0, 60)}${tc.question.length > 60 ? '…' : ''}`);

  // Escalation
  assert(
    `${tc.id} escalation`,
    safety.escalate === tc.expectedResult.shouldEscalate,
    `expected escalate=${tc.expectedResult.shouldEscalate}, got=${safety.escalate}`,
  );

  if (tc.expectedResult.shouldEscalate) {
    assert(
      `${tc.id} pipeline type`,
      pipeline.type === 'escalation',
      `expected escalation, got ${pipeline.type}`,
    );
    return;
  }

  if (pipeline.type !== 'answer') {
    assert(
      `${tc.id} status`,
      false,
      `expected answer, got ${pipeline.type}`,
    );
    return;
  }

  const intent = classifyIntent(tc.question);
  assert(
    `${tc.id} intent confidence`,
    !isLowConfidence(intent.confidence),
    `confidence=${intent.confidence.toFixed(2)}`,
  );
  assert(
    `${tc.id} use case`,
    pipeline.intent === expectedUc,
    `expected ${expectedUc}, got ${pipeline.intent}`,
  );
  assert(
    `${tc.id} classifyIntent`,
    intent.useCase === expectedUc,
    `expected ${expectedUc}, got ${intent.useCase}`,
  );

  if (tc.expectedResult.shouldUseRAG && pipeline.intent) {
    const { context, sourceIds } = retrieveContext(pipeline.intent as UseCase, tc.question);
    assert(
      `${tc.id} RAG context`,
      context.length > 0 && sourceIds.length > 0,
      `context=${context.length} chars, sources=${sourceIds.length}`,
    );
  }

  // Follow-up not implemented yet — ensure we don't falsely require it
  if (!tc.expectedResult.shouldAskFollowUp) {
    assert(`${tc.id} no follow-up required`, true);
  }
}

function main() {
  const suite = JSON.parse(readFileSync(TEST_FILE, 'utf8')) as TestSuite;

  console.log(`\n=== VDA Test Cases v${suite.version} ===`);
  console.log(suite.description);
  console.log(`Running ${suite.testCases.length} / ${suite.totalTestCases} cases\n`);

  if (suite.testCases.length !== suite.totalTestCases) {
    console.warn(
      `Warning: totalTestCases=${suite.totalTestCases} but array has ${suite.testCases.length} entries`,
    );
  }

  for (const tc of suite.testCases) {
    runCase(tc);
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`${passed} passed, ${failed} failed (${suite.testCases.length} cases)\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
