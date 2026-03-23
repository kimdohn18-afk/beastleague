import { LEVEL_TABLE, xpRequiredForNextLevel, levelFromTotalXp } from '../config/levelTable';

describe('LEVEL_TABLE', () => {
  it('길이가 99여야 한다', () => {
    expect(LEVEL_TABLE).toHaveLength(99);
  });

  it('Lv1→2 필요 XP가 100이어야 한다', () => {
    expect(LEVEL_TABLE[0]).toBe(100);
  });

  it('각 레벨 필요 XP가 이전 레벨보다 크거나 같아야 한다', () => {
    for (let i = 1; i < LEVEL_TABLE.length; i++) {
      expect(LEVEL_TABLE[i]).toBeGreaterThanOrEqual(LEVEL_TABLE[i - 1]);
    }
  });

  it('모든 값이 정수여야 한다 (소수점 올림)', () => {
    LEVEL_TABLE.forEach((xp) => {
      expect(Number.isInteger(xp)).toBe(true);
    });
  });
});

describe('xpRequiredForNextLevel', () => {
  it('레벨 1은 100 XP가 필요하다', () => {
    expect(xpRequiredForNextLevel(1)).toBe(100);
  });

  it('범위 밖 레벨은 에러를 던진다', () => {
    expect(() => xpRequiredForNextLevel(0)).toThrow(RangeError);
    expect(() => xpRequiredForNextLevel(100)).toThrow(RangeError);
  });
});

describe('levelFromTotalXp', () => {
  it('XP 0은 레벨 1이다', () => {
    expect(levelFromTotalXp(0)).toBe(1);
  });

  it('XP 99는 레벨 1이다', () => {
    expect(levelFromTotalXp(99)).toBe(1);
  });

  it('XP 100은 레벨 2다', () => {
    expect(levelFromTotalXp(100)).toBe(2);
  });
});
