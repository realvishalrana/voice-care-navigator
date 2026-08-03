import type { UseCase } from '../types.js';

/** Maps testcase expectedIntent labels to pipeline use cases */
export const INTENT_TO_USE_CASE: Record<string, UseCase> = {
  MEDICATION_SCHEDULE: 'UC1',
  FOLLOW_UP: 'UC1',
  SCHEME_ELIGIBILITY: 'UC2',
  FIND_HEALTH_CENTER: 'UC3',
  EMERGENCY: 'UC4',
  TELECONSULTATION: 'UC4',
};

export function expectedUseCase(expectedIntent: string, fallbackUseCase?: string): UseCase {
  if (INTENT_TO_USE_CASE[expectedIntent]) {
    return INTENT_TO_USE_CASE[expectedIntent];
  }
  if (fallbackUseCase && ['UC1', 'UC2', 'UC3', 'UC4'].includes(fallbackUseCase)) {
    return fallbackUseCase as UseCase;
  }
  throw new Error(`Unknown expectedIntent: ${expectedIntent}`);
}
