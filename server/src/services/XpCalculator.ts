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

  // 홈/원정 판별
  const side = team === game.homeTeam ? 'home' : 'away';
  const batters = records[side];
  if (!Array.isArray(batters)) return null;

  // 타순 매칭 (order가 "1", "2" ... "9" 문자열로 저장됨)
  return batters.find((b: any) => String(b.order) === String(battingOrder)) || null;
}

/**
 * 타자 기록에서 상세 정보 파싱
 * - 크롤러가 수집하는 기본 필드: atBats, hits, rbi, runs
 * - 이벤트에서 추출: doubles, triples, homeRuns, stolenBases, walkOff 등
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

  // 이벤트에서 장타/도루 추출
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

    // 이벤트에서 선수명 포함 여부로 매칭
    if (!detail.includes(playerName) && playerName.length > 0) continue;

    const typeLower = type.toLowerCase();
    if (typeLower.includes('홈런') || typeLower === '홈런') {
      homeRuns++;
    } else if (typeLower.includes('2루타') || typeLower === '2루타') {
      doubles++;
    } else if (typeLower.includes('3루타') || typeLower === '3루타') {
      triples++;
    } else if (typeLower.includes('도루') && !typeLower.includes('실패')) {
      stolenBases++;
    } else if (typeLower.includes('도루실패') || typeLower.includes('도루 실패')) {
      stolenBaseFails++;
    } else if (typeLower.includes('볼넷') || typeLower.includes('사구')) {
      walks++;
    } else if (typeLower.includes('끝내기')) {
      walkOff = true;
    }
  }

  // 이벤트에서 장타를 못 찾은 경우, 안타 수만으로 처리
  // (장타 구분 불가 시 전부 단타로 계산)

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

  // 장타 먼저 계산, 나머지가 단타
  const singles = Math.max(0, batter.hits - batter.doubles - batter.triples - batter.homeRuns);

  xp += singles * BATTER_XP.HIT;          // 단타
  xp += batter.doubles * BATTER_XP.DOUBLE; // 2루타
  xp += batter.triples * BATTER_XP.TRIPLE; // 3루타
  xp += batter.homeRuns * BATTER_XP.HR;    // 홈런
  xp += batter.rbi * BATTER_XP.RBI;        // 타점
  xp += batter.runs * BATTER_XP.RUN;       // 득점
  xp += batter.stolenBases * BATTER_XP.SB; // 도루
  xp += batter.stolenBaseFails * BATTER_XP.SB_FAIL; // 도루실패

  if (batter.walkOff) {
    xp += BATTER_XP.WALK_OFF;              // 끝내기 안타
  }

  // 무안타 페널티 (3타석 이상 출전 & 0안타)
  if (batter.atBats >= 3 && batter.hits === 0) {
    xp += BATTER_XP.NO_HIT_PENALTY;
  }

  return xp;
}

/**
 * 단일 예측 정산 (타자 기록 기반)
 */
export function calculatePredictionXp(
  game: IGame,
  prediction: IPrediction
): IPredictionResult {
  const winner = getWinner(game);
  const winCorrect = winner !== '' && prediction.predictedWinner === winner;

  // === 타자 기록 기반 정산 (battingOrder가 있는 경우) ===
  if (prediction.battingOrder && prediction.team) {
    const batter = findBatterByOrder(game, prediction.team, prediction.battingOrder);

    let batterResult: IBatterResult;
    let xpFromPlayer = 0;

    if (batter) {
      batterResult = parseBatterResult(batter, game, prediction.team);
      xpFromPlayer = calculateBatterXp(batterResult);
    } else {
      // 해당 타순 선수를 찾지 못한 경우 (대타 등으로 변경)
      batterResult = {
        playerName: '(선수 없음)',
        atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, runs: 0, stolenBases: 0, stolenBaseFails: 0, walks: 0, walkOff: false,
      };
    }

    // 팀 승리 보너스
    const teamWon = winner === prediction.team;
    const xpFromTeamWin = teamWon ? TEAM_WIN_XP : 0;

    // 승리 예측 보너스
    const xpFromWinPredict = winCorrect ? WIN_PREDICT_XP : WIN_PREDICT_FAIL_XP;

    const netXp = xpFromPlayer + xpFromTeamWin + xpFromWinPredict;

    return {
      winCorrect,
      netXp,
      xpFromPlayer,
      xpFromTeamWin,
      xpFromWinPredict,
      batterResult,
      // 하위호환 필드
      xpFromWin: xpFromWinPredict,
      xpFromDiff: 0,
      xpFromTotal: 0,
      xpLostDiff: 0,
      xpLostTotal: 0,
    };
  }

  // === 하위호환: 스코어 기반 정산 (기존 예측 처리) ===
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
