import { TrainingType } from '../types/Training';
import { StatType } from '../types/Character';

export interface TrainingRule {
  type: TrainingType;
  effects: Partial<Record<StatType, number>>;
  xpReward: number;
  bonusChance: number;     // 보너스 발동 확률 (0–1)
  bonusMultiplier: number; // 보너스 배율
}

export const TRAINING_RULES: Record<TrainingType, TrainingRule> = {
  batting: {
    type: 'batting',
    effects: { power: 0.3, skill: 0.2 },
    xpReward: 10,
    bonusChance: 0.2,
    bonusMultiplier: 1.5,
  },
  fielding: {
    type: 'fielding',
    effects: { skill: 0.3, agility: 0.2 },
    xpReward: 10,
    bonusChance: 0.2,
    bonusMultiplier: 1.5,
  },
  running: {
    type: 'running',
    effects: { agility: 0.3, stamina: 0.2 },
    xpReward: 10,
    bonusChance: 0.2,
    bonusMultiplier: 1.5,
  },
  mental: {
    type: 'mental',
    effects: { mind: 0.4, skill: 0.1 },
    xpReward: 10,
    bonusChance: 0.2,
    bonusMultiplier: 1.5,
  },
  conditioning: {
    type: 'conditioning',
    effects: { stamina: 0.3, mind: 0.2 },
    xpReward: 10,
    bonusChance: 0.2,
    bonusMultiplier: 1.5,
  },
};
