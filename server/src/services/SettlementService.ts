import { Server as SocketIOServer } from 'socket.io';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';
import { sendPushToUser } from './pushService';
import {
  BATTER_XP,
  TEAM_WIN_XP,
  WIN_PREDICT_XP,
  WIN_PREDICT_FAIL_XP,
} from '@beastleague/shared';

export interface SettlementResult {
  gameId: string;
  settledCount: number;
  details: Array<{
    placementId: string;
    characterName: string;
    team: string;
    battingOrder: number;
    winCorrect: boolean;
    netXp: number;
    playerName?: string;
  }>;
  errors: string[];
}

function calculateStreakBonus(streak: number): {
  daily: number;
  milestone: number;
  total: number;
  milestoneName: string | null;
} {
  let daily = 0;
  let milestone = 0;
  let milestoneName: string | null = null;

  if (streak >= 30) {
    daily = 10;
  } else if (streak >= 3) {
    daily = 5;
  }

  if (streak === 7) {
    milestone = 50;
    milestoneName = '7일 연속 보너스!';
  } else if (streak === 14) {
    milestone = 100;
    milestoneName = '14일 연속 보너스!';
  } else if (streak === 30) {
    milestone = 200;
    milestoneName = '30일 연속 보너스!';
  }

  return { daily, milestone, total: daily + milestone, milestoneName };
}

function getWinner(game: any): string {
  const home = game.homeScore ?? 0;
  const away = game.awayScore ?? 0;
  if (home > away) return game.homeTeam;
  if (away > home) return game.awayTeam;
  return '';
}

function findBatterByOrder(game: any, team: string, battingOrder: number): any | null {
  const records = game.batterRecords;
  if (!records) return null;
  const side = team === game.homeTeam ? 'home' : 'away';
  const batters = records[side];
  if (!Array.isArray(batters)) return null;
  return batters.find((b: any) => String(b.order) === String(battingOrder)) || null;
}

function calculateBatterXp(batter: any): { xpFromPlayer: number; xpBreakdown: any } {
  const atBats = parseInt(batter.atBats) || 0;
  const hits = parseInt(batter.hits) || 0;
  const doubles = parseInt(batter.doubles) || 0;
  const triples = parseInt(batter.triples) || 0;
  const homeRuns = parseInt(batter.homeRuns) || 0;
  const rbi = parseInt(batter.rbi) || 0;
  const runs = parseInt(batter.runs) || 0;
  const stolenBases = parseInt(batter.stolenBases) || 0;
  const stolenBaseFails = parseInt(batter.stolenBaseFails) || 0;
  const walkOff = !!batter.walkOff;

  const singles = Math.max(0, hits - doubles - triples - homeRuns);

  const breakdown = {
    hits: singles * BATTER_XP.HIT,
    double: doubles * BATTER_XP.DOUBLE,
    triple: triples * BATTER_XP.TRIPLE,
    homeRun: homeRuns * BATTER_XP.HR,
    rbi: rbi * BATTER_XP.RBI,
    runs: runs * BATTER_XP.RUN,
    stolenBase: stolenBases * BATTER_XP.SB,
    caughtStealing: stolenBaseFails * BATTER_XP.SB_FAIL,
    walkOff: walkOff ? BATTER_XP.WALK_OFF : 0,
    noHitPenalty: (atBats >= 3 && hits === 0) ? BATTER_XP.NO_HIT_PENALTY : 0,
    teamResult: 0,
  };

  const xpFromPlayer = breakdown.hits + breakdown.double + breakdown.triple +
    breakdown.homeRun + breakdown.rbi + breakdown.runs + breakdown.stolenBase +
    breakdown.caughtStealing + breakdown.walkOff + breakdown.noHitPenalty;

  return { xpFromPlayer, xpBreakdown: breakdown };
}

export async function settleGame(
  gameId: string,
  io: SocketIOServer
): Promise<SettlementResult> {
  const errors: string[] = [];
  const details: SettlementResult['details'] = [];

  const alreadySettled = await Placement.countDocuments({ gameId, status: 'settled' });
  const activePlacements = await Placement.find({ gameId, status: 'active' });

  if (activePlacements.length === 0) {
    if (alreadySettled > 0) {
      throw new Error(`이미 정산된 경기입니다: ${gameId}`);
    }
    return { gameId, settledCount: 0, details, errors };
  }

  const game = await Game.findOne({ gameId });
  if (!game) throw new Error(`경기를 찾을 수 없습니다: ${gameId}`);
  if (game.status !== 'finished')
    throw new Error(`경기가 아직 종료되지 않았습니다: ${gameId}`);

  const winner = getWinner(game);
  let settled = 0;

  for (const placement of activePlacements) {
    try {
      const character = await Character.findById(placement.characterId);
      if (!character) {
        errors.push(`캐릭터 없음: ${String(placement.characterId)}`);
        continue;
      }

      // 1. 타자 기록 찾기
      const batter = findBatterByOrder(game, placement.team, placement.battingOrder);
      let xpFromPlayer = 0;
      let xpBreakdown: any = {};
      let playerName = '(선수 없음)';

      if (batter) {
        playerName = batter.name || '(이름 없음)';
        const calc = calculateBatterXp(batter);
        xpFromPlayer = calc.xpFromPlayer;
        xpBreakdown = calc.xpBreakdown;
      }

      // 2. 팀 승리 보너스
      const teamWon = winner === placement.team;
      const xpFromTeamWin = teamWon ? TEAM_WIN_XP : 0;
      xpBreakdown.teamResult = xpFromTeamWin;

      // 3. 승리 예측
      const winCorrect = winner !== '' && placement.predictedWinner === winner;
      const xpFromPrediction = winCorrect ? WIN_PREDICT_XP : WIN_PREDICT_FAIL_XP;

      // 4. 스트릭 보너스
      const streakBonus = calculateStreakBonus(character.streak || 0);

      // 5. 총 XP
      const netXp = xpFromPlayer + xpFromTeamWin + xpFromPrediction + streakBonus.total;

       // 6. 캐릭터 XP 적용
      if (netXp > 0) {
        character.totalXp = (character.totalXp || 0) + netXp;
        character.currentXp = (character.currentXp || 0) + netXp;
      } else {
        character.currentXp = Math.max(0, (character.currentXp || 0) + netXp);
      }
      character.xp = Math.max(0, (character.xp || 0) + netXp);
      character.totalPlacements = (character.totalPlacements || 0) + 1;

      // 7. 업적 재계산 (10회 배수)
      if (character.totalPlacements >= 10 && character.totalPlacements % 10 === 0) {
        try {
          const { calculateAchievements, getAchievementById } = await import('./TraitCalculator');
          const achResult = await calculateAchievements(
            String(placement.userId),
            String(character._id)
          );
          character.activeTrait = achResult.activeTrait
            ? `${achResult.activeTrait.emoji} ${achResult.activeTrait.name}`
            : null;

          const prevEarned: string[] = (character as any).earnedAchievements || [];
          const newAchievements = achResult.earned.filter((id: string) => !prevEarned.includes(id));
          (character as any).earnedAchievements = achResult.earned;

          if (newAchievements.length > 0) {
            const achNames = newAchievements
              .map((id: string) => {
                const a = getAchievementById(id);
                return a ? `${a.emoji} ${a.name}` : id;
              })
              .join(', ');
            sendPushToUser(
              String(placement.userId),
              '🏆 새 업적 달성!',
              `${achNames}을(를) 달성했어요!`,
              { url: '/achievements' }
            ).catch((e) => console.error('[Push] Achievement push error:', e));
          }
        } catch (e) {
          console.error('[Achievement] Calculation error:', e);
        }
      }

      await character.save();

      // 8. Placement 상태 업데이트
      placement.status = 'settled';
      placement.isCorrect = winCorrect;
      placement.xpFromPlayer = xpFromPlayer;
      placement.xpFromPrediction = xpFromPrediction;
      placement.xpBreakdown = xpBreakdown;
      await placement.save();

      settled++;
      details.push({
        placementId: String(placement._id),
        characterName: character.name,
        team: placement.team,
        battingOrder: placement.battingOrder,
        winCorrect,
        netXp,
        playerName,
      });

      // 9. 푸시 알림
      const sign = netXp >= 0 ? '+' : '';
      let pushBody = `${playerName} (${placement.battingOrder}번)`;

      if (batter) {
        const statsLine = [
          `${batter.atBats || 0}타수 ${batter.hits || 0}안타`,
          (parseInt(batter.homeRuns) || 0) > 0 ? `${batter.homeRuns}홈런` : null,
          (parseInt(batter.rbi) || 0) > 0 ? `${batter.rbi}타점` : null,
          (parseInt(batter.stolenBases) || 0) > 0 ? `${batter.stolenBases}도루` : null,
        ].filter(Boolean).join(' ');
        pushBody += `: ${statsLine}`;
      }

      pushBody += `\n${character.name}: ${sign}${netXp} XP`;
      if (xpFromPlayer > 0) pushBody += `\n⚾ 타자 성적 +${xpFromPlayer}`;
      if (xpFromTeamWin > 0) pushBody += `\n✅ 팀 승리 +${xpFromTeamWin}`;
      if (xpFromPrediction > 0) pushBody += `\n🎯 승리 적중 +${xpFromPrediction}`;
      if (xpFromPrediction < 0) pushBody += `\n❌ 승리 예측 실패 ${xpFromPrediction}`;

      if (streakBonus.milestoneName) {
        pushBody += `\n🏆 ${streakBonus.milestoneName} +${streakBonus.total} XP`;
      } else if (streakBonus.total > 0) {
        pushBody += `\n🔥 ${character.streak}일 연속 +${streakBonus.total} XP`;
      }

      sendPushToUser(
        String(placement.userId),
        '⚾ 정산 완료!',
        pushBody,
        { url: '/' }
      ).catch((e) => console.error('[Push] Settlement push error:', e));

    } catch (err) {
      errors.push(`배치 처리 오류 (${String(placement._id)}): ${String(err)}`);
    }
  }

  io.emit('settlement:complete', { gameId, settledCount: settled, details });

  return { gameId, settledCount: settled, details, errors };
}
