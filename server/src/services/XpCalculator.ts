// server/src/services/XpCalculator.ts

import {
  BATTER_XP,
  TEAM_WIN_XP,
  WIN_PREDICT_XP,
  WIN_PREDICT_FAIL_XP,
} from '@beastleague/shared';
import { IGame } from '../models/Game';
import { IPrediction, IPredictionResult, IBatterResult } from '../models/Prediction';

/**
 * 경기 승자 판정
 */
function getWinner(game: IGame): string {
  const home = game.homeScore ?? 0;
  const away = game.awayScore ?? 0;
  if (home > away) return game.homeTeam;
  if (away > home) return game.awayTeam;
  return '';
}

/**
 * 해당 타순 선수의 기록 찾기
 */
function findBatterByOrder(
  game: IGame,
  team: string,
  battingOrder: number
): any | null {
  const records = (game as any).batterRecords;
  if (!records) return null;

  const side = team === game.homeTeam ? 'home' : 'away';
  const batters = records[side];
  if (!Array.isArray(batters)) return null;

  // order는 "1", "2" ... "9" 문자열
  return batters.find((b: any) => String(b.order) === String(battingOrder)) || null;
}

/**
 * 타자 기록 → IBatterResult 변환
 * 우선순위: 크롤러가 채운 상세 필드 > 이벤트 텍스트 파싱(폴백)
 */
function parseBatterResult(
  batter: any,
  game: IGame,
  team: string
): IBatterResult {
  const atBats = parseInt(batter.atBats) || 0;
  const hits = parseInt(batter.hits) || 0;
  const rbi = parseInt(batter.rbi) || 0;
  const runs = parseInt(batter.runs) || 0;
  const playerName = batter.name || '';

  // 크롤러 v5가 이미 채운 상세 필드 확인
  const hasDetailFromCrawler =
    (batter.homeRuns !== undefined && batter.homeRuns !== null) ||
    (batter.doubles !== undefined && batter.doubles !== null) ||
    (batter.stolenBases !== undefined && batter.stolenBases !== null);

  if (hasDetailFromCrawler) {
    // 크롤러가 이미 이벤트 매칭을 완료한 데이터 → 그대로 사용
    return {
      playerName,
      atBats,
      hits,
      doubles: parseInt(batter.doubles) || 0,
      triples: parseInt(batter.triples) || 0,
      homeRuns: parseInt(batter.homeRuns) || 0,
      rbi,
      runs,
      stolenBases: parseInt(batter.stolenBases) || 0,
      stolenBaseFails: parseInt(batter.stolenBaseFails) || 0,
      walks: parseInt(batter.walks) || 0,
      walkOff: !!batter.walkOff,
    };
  }

  // === 폴백: 구버전 크롤러 데이터 (상세 필드 없음) → 이벤트에서 추출 ===
  let homeRuns = 0;
  let doubles = 0;
  let triples = 0;
  let stolenBases = 0;
  let stolenBaseFails = 0;
  let walks = 0;
  let walkOff = false;

  const events: any[] = (game as any).events || [];
  for (const evt of events) {
    const detail: string = evt.detail || '';
    const type: string = evt.type || '';

    if (playerName.length === 0 || !detail.includes(playerName)) continue;

    if (type === '홈런') homeRuns++;
    else if (type === '2루타') doubles++;
    else if (type === '3루타') triples++;
    else if (type === '도루' && !type.includes('실패')) stolenBases++;
    else if (type.includes('도루실패') || type.includes('도루자')) stolenBaseFails++;
    else if (type === '볼넷' || type === '사구') walks++;
    else if (type.includes('끝내기')) walkOff = true;
  }

  return {
    playerName,
    atBats,
    hits,
    doubles,
    triples,
    homeRuns,
    rbi,
    runs,
    stolenBases,
    stolenBaseFails,
    walks,
    walkOff,
  };
}

/**
 * 타자 기록 → XP 계산
 */
function calculateBatterXp(batter: IBatterResult): number {
  let xp = 0;

  const singles = Math.max(0, batter.hits - batter.doubles - batter.triples - batter.homeRuns);

  xp += singles * BATTER_XP.HIT;
  xp += batter.doubles * BATTER_XP.DOUBLE;
  xp += batter.triples * BATTER_XP.TRIPLE;
  xp += batter.homeRuns * BATTER_XP.HR;
  xp += batter.rbi * BATTER_XP.RBI;
  xp += batter.runs * BATTER_XP.RUN;
  xp += batter.stolenBases * BATTER_XP.SB;
  xp += batter.stolenBaseFails * BATTER_XP.SB_FAIL;

  if (batter.walkOff) {
    xp += BATTER_XP.WALK_OFF;
  }

  if (batter.atBats >= 3 && batter.hits === 0) {
    xp += BATTER_XP.NO_HIT_PENALTY;
  }

  return xp;
}

/**
 * 단일 예측 정산
 */
export function calculatePredictionXp(
  game: IGame,
  prediction: IPrediction
): IPredictionResult {
  const winner = getWinner(game);
  const winCorrect = winner !== '' && prediction.predictedWinner === winner;

  // === 타자 기록 기반 정산 ===
  if (prediction.battingOrder && prediction.team) {
    const batter = findBatterByOrder(game, prediction.team, prediction.battingOrder);

    let batterResult: IBatterResult;
    let xpFromPlayer = 0;

    if (batter) {
      batterResult = parseBatterResult(batter, game, prediction.team);
      xpFromPlayer = calculateBatterXp(batterResult);
    } else {
      batterResult = {
        playerName: '(선수 없음)',
        atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, runs: 0, stolenBases: 0, stolenBaseFails: 0, walks: 0, walkOff: false,
      };
    }

    const teamWon = winner === prediction.team;
    const xpFromTeamWin = teamWon ? TEAM_WIN_XP : 0;
    const xpFromWinPredict = winCorrect ? WIN_PREDICT_XP : WIN_PREDICT_FAIL_XP;
    const netXp = xpFromPlayer + xpFromTeamWin + xpFromWinPredict;

    return {
      winCorrect,
      netXp,
      xpFromPlayer,
      xpFromTeamWin,
      xpFromWinPredict,
      batterResult,
      xpFromWin: xpFromWinPredict,
      xpFromDiff: 0,
      xpFromTotal: 0,
      xpLostDiff: 0,
      xpLostTotal: 0,
    };
  }

  // === 하위호환: 스코어 기반 정산 ===
  const { DIFF_MULTIPLIER, TOTAL_RUNS_MULTIPLIER, TOTAL_RUNS_RANGE } = require('@beastleague/shared');

  const xpFromWin = winCorrect ? WIN_PREDICT_XP : WIN_PREDICT_FAIL_XP;

  let diffCorrect: boolean | undefined;
  let xpFromDiff = 0;
  let xpLostDiff = 0;

  if (prediction.scoreDiffRange && prediction.xpBetOnDiff && prediction.xpBetOnDiff > 0) {
    const diff = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
    let actualDiff: string;
    if (diff >= 5) actualDiff = '5+';
    else if (diff >= 3) actualDiff = '3-4';
    else actualDiff = '1-2';

    diffCorrect = prediction.scoreDiffRange === actualDiff;
    if (diffCorrect) {
      xpFromDiff = Math.floor(prediction.xpBetOnDiff * DIFF_MULTIPLIER[prediction.scoreDiffRange]);
    } else {
      xpLostDiff = prediction.xpBetOnDiff;
    }
  }

  let totalCorrect: boolean | undefined;
  let xpFromTotal = 0;
  let xpLostTotal = 0;

  if (prediction.totalRunsRange && prediction.xpBetOnTotal && prediction.xpBetOnTotal > 0) {
    const total = (game.homeScore ?? 0) + (game.awayScore ?? 0);
    let actualTotal: string;
    if (total >= TOTAL_RUNS_RANGE.high.min) actualTotal = 'high';
    else if (total >= TOTAL_RUNS_RANGE.normal.min) actualTotal = 'normal';
    else actualTotal = 'low';

    totalCorrect = prediction.totalRunsRange === actualTotal;
    if (totalCorrect) {
      xpFromTotal = Math.floor(prediction.xpBetOnTotal * TOTAL_RUNS_MULTIPLIER[prediction.totalRunsRange]);
    } else {
      xpLostTotal = prediction.xpBetOnTotal;
    }
  }

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
