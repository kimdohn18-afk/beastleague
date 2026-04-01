import { XP_RULES } from '@beastleague/shared';
import { IGame } from '../models/Game';

export interface XpBreakdown {
  hits: number;
  rbi: number;
  runs: number;
  noHitPenalty: number;
  homeRun: number;
  double: number;
  triple: number;
  stolenBase: number;
  caughtStealing: number;
  walkOff: number;
  teamResult: number;
  total: number;
}

/**
 * 특정 경기에서 특정 팀/타순의 XP를 계산
 */
export function calculatePlacementXp(
  game: IGame,
  team: string,
  battingOrder: number
): XpBreakdown {
  const breakdown: XpBreakdown = {
    hits: 0, rbi: 0, runs: 0, noHitPenalty: 0,
    homeRun: 0, double: 0, triple: 0,
    stolenBase: 0, caughtStealing: 0, walkOff: 0,
    teamResult: 0, total: 0,
  };

  if (!game.batterRecords) return breakdown;

  // 1. 해당 팀의 타자 기록 찾기
  const isHome = team === game.homeTeam;
  const batters = isHome ? game.batterRecords.home : game.batterRecords.away;
  if (!batters || batters.length === 0) return breakdown;

  // 2. 해당 타순 선수들 찾기 (주전 + 교체 모두)
  const orderStr = String(battingOrder);
  const orderBatters = batters.filter(b => b.order === orderStr);
  if (orderBatters.length === 0) return breakdown;

  // 3. 타순 기록 합산
  let totalAB = 0;
  let totalHits = 0;
  let totalRbi = 0;
  let totalRuns = 0;
  const playerNames: string[] = [];

  for (const b of orderBatters) {
    totalAB += parseInt(b.atBats) || 0;
    totalHits += parseInt(b.hits) || 0;
    totalRbi += parseInt(b.rbi) || 0;
    totalRuns += parseInt(b.runs) || 0;
    if (b.name) playerNames.push(b.name);
  }

  // 교체 선수 이름도 수집 (order가 빈 문자열인 경우)
  // 교체 선수는 주전 바로 다음에 위치하므로, 이미 orderBatters에 포함되지 않음
  // batters 배열에서 해당 타순 주전 이후 order=""인 선수 찾기
  for (let i = 0; i < batters.length; i++) {
    if (batters[i].order === orderStr) {
      // 다음 선수들 중 order가 빈 문자열인 교체선수 수집
      for (let j = i + 1; j < batters.length; j++) {
        if (batters[j].order === '') {
          totalAB += parseInt(batters[j].atBats) || 0;
          totalHits += parseInt(batters[j].hits) || 0;
          totalRbi += parseInt(batters[j].rbi) || 0;
          totalRuns += parseInt(batters[j].runs) || 0;
          if (batters[j].name) playerNames.push(batters[j].name);
        } else {
          break; // 다음 타순 시작
        }
      }
    }
  }

  // 4. 기본 기록 XP
  breakdown.hits = totalHits * XP_RULES.hit;
  breakdown.rbi = totalRbi * XP_RULES.rbi;
  breakdown.runs = totalRuns * XP_RULES.run;

  if (totalAB >= XP_RULES.noHitMinAB && totalHits === 0) {
    breakdown.noHitPenalty = XP_RULES.noHitPenalty;
  }

  // 5. 이벤트 보너스 (선수 이름 매칭)
  if (game.events && game.events.length > 0) {
    for (const event of game.events) {
      const detail = event.detail || '';
      const type = event.type || '';

      for (const name of playerNames) {
        if (!detail.includes(name)) continue;

        if (type === '홈런') {
          // 이름이 포함된 홈런 횟수 세기 (같은 detail에 여러 선수 가능)
          const regex = new RegExp(name, 'g');
          const matches = detail.match(regex);
          breakdown.homeRun += (matches ? matches.length : 1) * XP_RULES.homeRun;
        }
        if (type === '2루타') {
          breakdown.double += XP_RULES.double;
        }
        if (type === '3루타') {
          breakdown.triple += XP_RULES.triple;
        }
        if (type === '도루') {
          breakdown.stolenBase += XP_RULES.stolenBase;
        }
        if (type === '도루자') {
          breakdown.caughtStealing += XP_RULES.caughtStealing;
        }
        if (type === '결승타') {
          breakdown.walkOff += XP_RULES.walkOff;
        }
      }
    }
  }

  // 6. 팀 승패 보너스
  const homeScore = game.homeScore ?? 0;
  const awayScore = game.awayScore ?? 0;
  let teamWon = false;
  if (isHome && homeScore > awayScore) teamWon = true;
  if (!isHome && awayScore > homeScore) teamWon = true;
  breakdown.teamResult = teamWon ? XP_RULES.teamWin : XP_RULES.teamLose;

  // 7. 합계
  breakdown.total =
    breakdown.hits + breakdown.rbi + breakdown.runs +
    breakdown.noHitPenalty +
    breakdown.homeRun + breakdown.double + breakdown.triple +
    breakdown.stolenBase + breakdown.caughtStealing +
    breakdown.walkOff + breakdown.teamResult;

  return breakdown;
}
