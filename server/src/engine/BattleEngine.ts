import { BattleResult } from '@beastleague/shared';

export interface BattleEngineResult {
  result: { player1: BattleResult; player2: BattleResult };
  xpAwarded: { player1: number; player2: number };
}

const XP_WIN = 25;
const XP_LOSE = 5;
const XP_DRAW = 15;
const XP_BOTH_ZERO = 5;
const DRAW_THRESHOLD = 0.1; // 10% 이내 차이면 무승부

/**
 * 두 플레이어의 statGain(양수 합산)을 비교해 대결 결과를 결정.
 * 순수 함수.
 */
export function executeBattle(
  player1StatGain: number,
  player2StatGain: number
): BattleEngineResult {
  // 둘 다 0
  if (player1StatGain === 0 && player2StatGain === 0) {
    return {
      result: { player1: 'draw', player2: 'draw' },
      xpAwarded: { player1: XP_BOTH_ZERO, player2: XP_BOTH_ZERO },
    };
  }

  const larger = Math.max(player1StatGain, player2StatGain);
  const diff = larger === 0 ? 0 : Math.abs(player1StatGain - player2StatGain) / larger;

  if (diff <= DRAW_THRESHOLD) {
    return {
      result: { player1: 'draw', player2: 'draw' },
      xpAwarded: { player1: XP_DRAW, player2: XP_DRAW },
    };
  }

  if (player1StatGain > player2StatGain) {
    return {
      result: { player1: 'win', player2: 'lose' },
      xpAwarded: { player1: XP_WIN, player2: XP_LOSE },
    };
  }

  return {
    result: { player1: 'lose', player2: 'win' },
    xpAwarded: { player1: XP_LOSE, player2: XP_WIN },
  };
}
