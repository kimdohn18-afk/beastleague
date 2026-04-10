import { Server as SocketIOServer } from 'socket.io';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';
import { calculatePlacementXp, XpBreakdown } from './XpCalculator';
import { sendPushToUser } from './pushService';

export interface SettlementResult {
  gameId: string;
  settledPlacements: number;
  details: Array<{
    placementId: string;
    characterName: string;
    team: string;
    battingOrder: number;
    xpFromPlayer: number;
    xpFromPrediction: number;
    xpFromStreak: number;
    totalXp: number;
    breakdown: XpBreakdown;
  }>;
  errors: string[];
}

/**
 * streak 보너스 계산
 * - 1~2일: +0
 * - 3일 이상: 매일 +5
 * - 7일 달성: 추가 +50
 * - 14일 달성: 추가 +100
 * - 30일 달성: 추가 +200
 * - 30일 초과: 매일 +10 (기본 +5 대신)
 */
function calculateStreakBonus(streak: number): { daily: number; milestone: number; total: number; milestoneName: string | null } {
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

export async function settleGame(
  gameId: string,
  io: SocketIOServer
): Promise<SettlementResult> {
  const errors: string[] = [];
  const details: SettlementResult['details'] = [];

  const settledCount = await Placement.countDocuments({ gameId, status: 'settled' });
  const activePlacements = await Placement.find({ gameId, status: 'active' });

  if (activePlacements.length === 0) {
    if (settledCount > 0) {
      throw new Error(`이미 정산된 경기입니다: ${gameId}`);
    }
    return { gameId, settledPlacements: 0, details, errors };
  }

  const game = await Game.findOne({ gameId });
  if (!game) throw new Error(`경기를 찾을 수 없습니다: ${gameId}`);
  if (game.status !== 'finished') throw new Error(`경기가 아직 종료되지 않았습니다: ${gameId}`);

  const homeScore = game.homeScore ?? 0;
  const awayScore = game.awayScore ?? 0;
  let winner = '';
  if (homeScore > awayScore) winner = game.homeTeam;
  else if (awayScore > homeScore) winner = game.awayTeam;

  let settledPlacements = 0;

  for (const placement of activePlacements) {
    try {
      const character = await Character.findById(placement.characterId);
      if (!character) {
        errors.push(`캐릭터 없음: ${String(placement.characterId)}`);
        continue;
      }

      const breakdown = calculatePlacementXp(
        game,
        placement.team,
        placement.battingOrder
      );

      const xpFromPlayer = breakdown.total - breakdown.teamResult;

      let xpFromPrediction = 0;
      let isCorrect = false;
      if (winner && placement.predictedWinner === winner) {
        xpFromPrediction = 30;
        isCorrect = true;
      }

      // streak 보너스 계산
      const streakBonus = calculateStreakBonus(character.streak || 0);
      const xpFromStreak = streakBonus.total;

      const totalXp = breakdown.total + xpFromPrediction + xpFromStreak;

      character.xp = (character.xp || 0) + totalXp;
      character.totalPlacements = (character.totalPlacements || 0) + 1;

      // 10회 배수마다 칭호/뱃지 재계산
      if (character.totalPlacements >= 10 && character.totalPlacements % 10 === 0) {
        try {
          const { calculateTraits, getBadgeById } = await import('./TraitCalculator');
          const traitResult = await calculateTraits(character);
          character.activeTrait = traitResult.activeTrait;
          character.earnedBadges = traitResult.earnedBadges;

          if (traitResult.newBadges.length > 0) {
            const badgeNames = traitResult.newBadges
              .map(id => {
                const b = getBadgeById(id);
                return b ? `${b.emoji} ${b.name}` : id;
              })
              .join(', ');

            sendPushToUser(
              String(placement.userId),
              '🏆 새 뱃지 획득!',
              `${badgeNames}을(를) 달성했어요!`,
              { url: '/badges' }
            ).catch((e) => console.error('[Push] Badge push error:', e));
          }
        } catch (e) {
          console.error('[Trait] Calculation error:', e);
        }
      }

      await character.save();

      placement.status = 'settled';
      placement.isCorrect = isCorrect;
      placement.xpFromPlayer = xpFromPlayer + breakdown.teamResult;
      placement.xpFromPrediction = xpFromPrediction;
      placement.xpBreakdown = {
        hits: breakdown.hits,
        rbi: breakdown.rbi,
        runs: breakdown.runs,
        noHitPenalty: breakdown.noHitPenalty,
        homeRun: breakdown.homeRun,
        double: breakdown.double,
        triple: breakdown.triple,
        stolenBase: breakdown.stolenBase,
        caughtStealing: breakdown.caughtStealing,
        walkOff: breakdown.walkOff,
        teamResult: breakdown.teamResult,
        total: breakdown.total,
      };
      await placement.save();

      settledPlacements++;
      details.push({
        placementId: String(placement._id),
        characterName: character.name,
        team: placement.team,
        battingOrder: placement.battingOrder,
        xpFromPlayer: xpFromPlayer + breakdown.teamResult,
        xpFromPrediction,
        xpFromStreak,
        totalXp,
        breakdown,
      });

      // 개인화 푸시 알림 전송
      const sign = totalXp >= 0 ? '+' : '';
      let pushBody = `${character.name}이(가) ${sign}${totalXp} XP를 획득했어요!`;

      if (streakBonus.milestoneName) {
        pushBody += `\n🏆 ${streakBonus.milestoneName} +${streakBonus.total} XP`;
      } else if (xpFromStreak > 0) {
        pushBody += `\n🔥 ${character.streak}일 연속 보너스 +${xpFromStreak} XP`;
      }

      sendPushToUser(
        String(placement.userId),
        '⚾ 정산 완료!',
        pushBody,
        { url: '/my-placements' }
      ).catch((e) => console.error('[Push] Settlement push error:', e));

    } catch (err) {
      errors.push(`배치 처리 오류 (${String(placement._id)}): ${String(err)}`);
    }
  }

  io.emit('settlement:complete', { gameId, settledPlacements, details });

  return { gameId, settledPlacements, details, errors };
}
