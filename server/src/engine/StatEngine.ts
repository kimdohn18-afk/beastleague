import {
  BatterGroupStats,
  PitcherStats,
  CharacterStats,
} from '@beastleague/shared';
import { STAT_RULE_MAP } from '@beastleague/shared';

/**
 * BatterGroupStats(+선택적 PitcherStats)를 받아 스탯 변화량을 계산하는 순수 함수.
 * DB/네트워크 호출 없음.
 */
export function calculateStatGains(
  batterGroup: BatterGroupStats,
  pitcherStats?: PitcherStats
): Partial<CharacterStats> {
  const gains: Partial<CharacterStats> = {};

  const add = (key: keyof CharacterStats, value: number) => {
    gains[key] = round2((gains[key] ?? 0) + value);
  };

  // HR
  const hrRule = STAT_RULE_MAP['HR'];
  if (batterGroup.HR > 0 && hrRule.effects.power !== undefined) {
    add('power', batterGroup.HR * hrRule.effects.power);
  }

  // 3B
  const tbRule = STAT_RULE_MAP['3B'];
  if (batterGroup['3B'] > 0) {
    if (tbRule.effects.power !== undefined) add('power', batterGroup['3B'] * tbRule.effects.power);
    if (tbRule.effects.agility !== undefined) add('agility', batterGroup['3B'] * tbRule.effects.agility);
  }

  // 2B
  const dbRule = STAT_RULE_MAP['2B'];
  if (batterGroup['2B'] > 0 && dbRule.effects.power !== undefined) {
    add('power', batterGroup['2B'] * dbRule.effects.power);
  }

  // H (단타만: H - 2B - 3B - HR, 음수면 0)
  const hRule = STAT_RULE_MAP['H'];
  const singles = Math.max(
    0,
    batterGroup.H - batterGroup['2B'] - batterGroup['3B'] - batterGroup.HR
  );
  if (singles > 0 && hRule.effects.skill !== undefined) {
    add('skill', singles * hRule.effects.skill);
  }

  // MULTI_HIT (H >= 2이면 1회 적용)
  if (batterGroup.H >= 2) {
    const mhRule = STAT_RULE_MAP['MULTI_HIT'];
    if (mhRule.effects.skill !== undefined) {
      add('skill', mhRule.effects.skill);
    }
  }

  // SB
  const sbRule = STAT_RULE_MAP['SB'];
  if (batterGroup.SB > 0 && sbRule.effects.agility !== undefined) {
    add('agility', batterGroup.SB * sbRule.effects.agility);
  }

  // RUN
  const runRule = STAT_RULE_MAP['RUN'];
  if (batterGroup.RUN > 0 && runRule.effects.agility !== undefined) {
    add('agility', batterGroup.RUN * runRule.effects.agility);
  }

  // BB
  const bbRule = STAT_RULE_MAP['BB'];
  if (batterGroup.BB > 0 && bbRule.effects.mind !== undefined) {
    add('mind', batterGroup.BB * bbRule.effects.mind);
  }

  // K (음수)
  const kRule = STAT_RULE_MAP['K'];
  if (batterGroup.K > 0 && kRule.effects.mind !== undefined) {
    add('mind', batterGroup.K * kRule.effects.mind);
  }

  // PA = AB + BB
  const paRule = STAT_RULE_MAP['PA'];
  const pa = batterGroup.AB + batterGroup.BB;
  if (pa > 0 && paRule.effects.stamina !== undefined) {
    add('stamina', pa * paRule.effects.stamina);
  }

  // IP (투수 스탯이 있을 때만)
  if (pitcherStats && pitcherStats.IP > 0) {
    const ipRule = STAT_RULE_MAP['IP'];
    if (ipRule.effects.stamina !== undefined) {
      add('stamina', pitcherStats.IP * ipRule.effects.stamina);
    }
  }

  return gains;
}

/**
 * current 스탯에 gains를 더하고, 각 값을 1~100으로 clamp.
 */
export function applyStatGains(
  current: CharacterStats,
  gains: Partial<CharacterStats>
): CharacterStats {
  const keys: (keyof CharacterStats)[] = ['power', 'agility', 'skill', 'stamina', 'mind'];
  const result = { ...current };
  for (const key of keys) {
    if (gains[key] !== undefined) {
      result[key] = clamp(round2(current[key] + gains[key]!), 1, 100);
    }
  }
  return result;
}

/**
 * gains의 모든 값 절대값 합산 × 10 = 획득 XP (소수점 버림)
 */
export function calculateXpFromGains(gains: Partial<CharacterStats>): number {
  const total = Object.values(gains).reduce((sum, v) => sum + Math.abs(v ?? 0), 0);
  return Math.floor(total * 10);
}

// ── 내부 유틸 ──────────────────────────────────────────────
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
