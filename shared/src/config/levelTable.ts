/**
 * 레벨 1→2 필요 XP = 100
 * 이후 매 레벨 × 1.15, 소수점 올림
 * LEVEL_TABLE[i] = 레벨 (i+1)에서 (i+2)로 올라가는 데 필요한 XP
 * 길이 = 99 (Lv1→2 ~ Lv99→cap)
 */
export const LEVEL_TABLE: number[] = (() => {
  const table: number[] = [];
  let xp = 100;
  for (let i = 0; i < 99; i++) {
    table.push(Math.ceil(xp));
    xp *= 1.15;
  }
  return table;
})();

/**
 * 특정 레벨에서 다음 레벨로 올라가는 데 필요한 XP 반환
 * @param level 현재 레벨 (1–99)
 */
export function xpRequiredForNextLevel(level: number): number {
  if (level < 1 || level > 99) throw new RangeError(`Invalid level: ${level}`);
  return LEVEL_TABLE[level - 1];
}

/**
 * 총 누적 XP로 현재 레벨 계산
 */
export function levelFromTotalXp(totalXp: number): number {
  let cumulative = 0;
  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    cumulative += LEVEL_TABLE[i];
    if (totalXp < cumulative) return i + 1;
  }
  return 99;
}
