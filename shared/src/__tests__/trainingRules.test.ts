import { TRAINING_RULES } from '../config/trainingRules';
import { TrainingType } from '../types/Training';

const ALL_TRAINING_TYPES: TrainingType[] = [
  'batting', 'fielding', 'running', 'mental', 'conditioning',
];

describe('TRAINING_RULES', () => {
  it('모든 TrainingType에 대한 규칙이 존재해야 한다', () => {
    ALL_TRAINING_TYPES.forEach((type) => {
      expect(TRAINING_RULES[type]).toBeDefined();
    });
  });

  it('모든 규칙의 xpReward가 양수여야 한다', () => {
    ALL_TRAINING_TYPES.forEach((type) => {
      expect(TRAINING_RULES[type].xpReward).toBeGreaterThan(0);
    });
  });

  it('bonusChance가 0~1 사이여야 한다', () => {
    ALL_TRAINING_TYPES.forEach((type) => {
      const { bonusChance } = TRAINING_RULES[type];
      expect(bonusChance).toBeGreaterThanOrEqual(0);
      expect(bonusChance).toBeLessThanOrEqual(1);
    });
  });

  it('모든 effects 값이 number 타입이어야 한다', () => {
    ALL_TRAINING_TYPES.forEach((type) => {
      Object.values(TRAINING_RULES[type].effects).forEach((val) => {
        expect(typeof val).toBe('number');
      });
    });
  });
});
