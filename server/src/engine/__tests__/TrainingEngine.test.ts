import { executeTraining } from '../TrainingEngine';
import { CharacterStats } from '@beastleague/shared';

const baseStats = (): CharacterStats => ({
  power: 50, agility: 50, skill: 50, stamina: 50, mind: 50,
});

describe('executeTraining', () => {
  it('batting 훈련 → power, skill 변화량이 양수', () => {
    const result = executeTraining('batting', 1, baseStats());
    expect(result.statChanges.power).toBeGreaterThan(0);
    expect(result.statChanges.skill).toBeGreaterThan(0);
  });

  it('보너스 발생 시 효과 ×1.5 (Math.random 모킹)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // 0.1 < 0.2 → 보너스
    const result = executeTraining('batting', 1, baseStats());
    // batting: power=0.3×1.5=0.45, skill=0.2×1.5=0.3
    expect(result.bonusApplied).toBe(true);
    expect(result.statChanges.power).toBeCloseTo(0.45, 2);
    expect(result.statChanges.skill).toBeCloseTo(0.3, 2);
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('보너스 미발생 시 원래 효과 (Math.random 모킹)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // 0.5 >= 0.2 → 보너스 없음
    const result = executeTraining('batting', 1, baseStats());
    expect(result.bonusApplied).toBe(false);
    expect(result.statChanges.power).toBeCloseTo(0.3, 2);
    expect(result.statChanges.skill).toBeCloseTo(0.2, 2);
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('xpGained는 항상 10 (보너스 여부 무관)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(executeTraining('batting', 1, baseStats()).xpGained).toBe(10);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(executeTraining('batting', 2, baseStats()).xpGained).toBe(10);
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('모든 TrainingType 실행 가능', () => {
    const types = ['batting', 'fielding', 'running', 'mental', 'conditioning'] as const;
    types.forEach((t) => {
      expect(() => executeTraining(t, 1, baseStats())).not.toThrow();
    });
  });
});
