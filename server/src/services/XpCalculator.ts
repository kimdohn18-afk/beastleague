// server/src/services/XpCalculator.ts

import {
  WIN_PREDICT_XP,
  WIN_PREDICT_FAIL_XP,
  DIFF_MULTIPLIER,
  TOTAL_RUNS_MULTIPLIER,
  TOTAL_RUNS_RANGE,
} from '@beastleague/shared';
import { IGame } from '../models/Game';
import { IPrediction, IPredictionResult, ScoreDiffRange, TotalRunsRange } from '../models/Prediction';

/**
 * 경기 승자 판정
 */
function getWinner(game: IGame): string {
  const home = game.homeScore ?? 0;
  const away = game.awayScore ?? 0;
  if (home > away) return game.homeTeam;
  if (away > home) return game.awayTeam;
  return ''; // 무승부 (KBO에서는 거의 없지만 안전장치)
}

/**
 * 점수차 범위 판정
 */
function getActualDiffRange(game: IGame): ScoreDiffRange {
  const diff = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
  if (diff >= 5) return '5+';
  if (diff >= 3) return '3-4';
  return '1-2';
}

/**
 * 총득점 범위 판정
 */
function getActualTotalRange(game: IGame): TotalRunsRange {
  const total = (game.homeScore ?? 0) + (game.awayScore ?? 0);
  if (total >= TOTAL_RUNS_RANGE.high.min) return 'high';
  if (total >= TOTAL_RUNS_RANGE.normal.min) return 'normal';
  return 'low';
}

/**
 * 단일 예측 정산
 */
export function calculatePredictionXp(
  game: IGame,
  prediction: IPrediction
): IPredictionResult {
  const winner = getWinner(game);

  // 1. 승리 예측
  const winCorrect = winner !== '' && prediction.predictedWinner === winner;
  const xpFromWin = winCorrect ? WIN_PREDICT_XP : WIN_PREDICT_FAIL_XP;

  // 2. 점수차 예측
  let diffCorrect: boolean | undefined;
  let xpFromDiff = 0;
  let xpLostDiff = 0;

  if (prediction.scoreDiffRange && prediction.xpBetOnDiff && prediction.xpBetOnDiff > 0) {
    const actualDiff = getActualDiffRange(game);
    diffCorrect = prediction.scoreDiffRange === actualDiff;

    if (diffCorrect) {
      const multiplier = DIFF_MULTIPLIER[prediction.scoreDiffRange];
      xpFromDiff = Math.floor(prediction.xpBetOnDiff * multiplier);
    } else {
      xpLostDiff = prediction.xpBetOnDiff;
    }
  }

  // 3. 총득점 예측
  let totalCorrect: boolean | undefined;
  let xpFromTotal = 0;
  let xpLostTotal = 0;

  if (prediction.totalRunsRange && prediction.xpBetOnTotal && prediction.xpBetOnTotal > 0) {
    const actualTotal = getActualTotalRange(game);
    totalCorrect = prediction.totalRunsRange === actualTotal;

    if (totalCorrect) {
      const multiplier = TOTAL_RUNS_MULTIPLIER[prediction.totalRunsRange];
      xpFromTotal = Math.floor(prediction.xpBetOnTotal * multiplier);
    } else {
      xpLostTotal = prediction.xpBetOnTotal;
    }
  }

  // 4. 최종 합산
  const netXp = xpFromWin + xpFromDiff + xpFromTotal - xpLostDiff - xpLostTotal;

  return {
    winCorrect,
    diffCorrect,
    totalCorrect,
    xpFromWin,
    xpFromDiff,
    xpFromTotal,
    xpLostDiff,
    xpLostTotal,
    netXp,
  };
}
