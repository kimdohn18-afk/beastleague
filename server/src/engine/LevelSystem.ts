import { LEVEL_TABLE } from '@beastleague/shared';

const MAX_LEVEL = 99;

export interface LevelUpResult {
  newLevel: number;
  newXp: number;
  leveledUp: boolean;
  levelsGained: number;
}

/**
 * XP 획득 후 레벨업 처리.
 * LEVEL_TABLE[i] = 레벨 (i+1) → (i+2) 필요 XP
 */
export function checkLevelUp(
  currentLevel: number,
  currentXp: number,
  gainedXp: number
): LevelUpResult {
  let level = currentLevel;
  let xp = currentXp + gainedXp;
  let levelsGained = 0;

  while (level < MAX_LEVEL) {
    const needed = LEVEL_TABLE[level - 1]; // 현재 레벨 → 다음 레벨 필요 XP
    if (xp >= needed) {
      xp -= needed;
      level++;
      levelsGained++;
    } else {
      break;
    }
  }

  return {
    newLevel: level,
    newXp: xp,
    leveledUp: levelsGained > 0,
    levelsGained,
  };
}

/**
 * 다음 레벨까지 남은 XP.
 * 레벨 99면 0 반환.
 */
export function getXpToNextLevel(currentLevel: number, currentXp: number): number {
  if (currentLevel >= MAX_LEVEL) return 0;
  const needed = LEVEL_TABLE[currentLevel - 1];
  return Math.max(0, needed - currentXp);
}
