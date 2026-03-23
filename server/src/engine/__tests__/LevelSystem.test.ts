import { checkLevelUp, getXpToNextLevel } from '../LevelSystem';

describe('checkLevelUp', () => {
  it('Lv1, XP 0, gained 100 → Lv2, XP 100, leveledUp true', () => {
    // LEVEL_TABLE[0]=100, Lv1→2 requires 100. After levelup newXp = 100 - 100 = 0... wait
    // checkLevelUp: xp = 0+100=100, needed=100, xp>=needed → level=2, xp=0
    const r = checkLevelUp(1, 0, 100);
    expect(r.newLevel).toBe(2);
    expect(r.newXp).toBe(0);
    expect(r.leveledUp).toBe(true);
    expect(r.levelsGained).toBe(1);
  });

  it('Lv1, XP 0, gained 50 → Lv1, XP 50, leveledUp false', () => {
    const r = checkLevelUp(1, 0, 50);
    expect(r.newLevel).toBe(1);
    expect(r.newXp).toBe(50);
    expect(r.leveledUp).toBe(false);
    expect(r.levelsGained).toBe(0);
  });

  it('연속 레벨업: Lv1, XP 0, gained 500 → 레벨 1 초과', () => {
    const r = checkLevelUp(1, 0, 500);
    expect(r.newLevel).toBeGreaterThan(1);
    expect(r.leveledUp).toBe(true);
    expect(r.levelsGained).toBeGreaterThan(1);
  });

  it('Lv99에서 추가 XP → Lv99 유지, XP 누적', () => {
    const r = checkLevelUp(99, 50, 999);
    expect(r.newLevel).toBe(99);
    expect(r.newXp).toBe(50 + 999);
    expect(r.leveledUp).toBe(false);
    expect(r.levelsGained).toBe(0);
  });
});

describe('getXpToNextLevel', () => {
  it('Lv1, XP 30 → 70 반환', () => {
    expect(getXpToNextLevel(1, 30)).toBe(70);
  });

  it('Lv1, XP 0 → 100 반환', () => {
    expect(getXpToNextLevel(1, 0)).toBe(100);
  });

  it('Lv99 → 0 반환', () => {
    expect(getXpToNextLevel(99, 0)).toBe(0);
  });
});
