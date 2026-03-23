import { TrainingType, CharacterStats } from '@beastleague/shared';
import { TRAINING_RULES } from '@beastleague/shared';

export interface TrainingResult {
  statChanges: Partial<CharacterStats>;
  xpGained: number;
  bonusApplied: boolean;
}

/**
 * 훈련 실행 — 순수 함수. 실제 캐릭터 스탯 적용은 API 레이어에서 처리.
 */
export function executeTraining(
  trainingType: TrainingType,
  _session: 1 | 2 | 3,
  _currentStats: CharacterStats
): TrainingResult {
  const rule = TRAINING_RULES[trainingType];
  const bonusApplied = Math.random() < rule.bonusChance;
  const multiplier = bonusApplied ? rule.bonusMultiplier : 1;

  const statChanges: Partial<CharacterStats> = {};
  for (const [key, value] of Object.entries(rule.effects) as [keyof CharacterStats, number][]) {
    statChanges[key] = round2(value * multiplier);
  }

  return {
    statChanges,
    xpGained: rule.xpReward, // 보너스와 무관하게 10
    bonusApplied,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
