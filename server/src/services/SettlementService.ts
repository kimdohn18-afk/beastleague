// server/src/services/SettlementService.ts

import { Server as SocketIOServer } from 'socket.io';
import { Character } from '../models/Character';
import { Prediction } from '../models/Prediction';
import { Game } from '../models/Game';
import { calculatePredictionXp } from './XpCalculator';
import { sendPushToUser } from './pushService';
import { ALL_KILL_BONUS } from '@beastleague/shared';

export interface SettlementResult {
  gameId: string;
  settledCount: number;
  details: Array<{
    predictionId: string;
    characterName: string;
    predictedWinner: string;
    winCorrect: boolean;
    netXp: number;
  }>;
  errors: string[];
}

/**
 * streak 보너스 계산 (기존 로직 유지)
 */
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

/**
 * 올킬 보너스 확인: 해당 날짜의 모든 예측이 정산 완료되고 전부 적중했는지
 */
async function checkAllKillBonus(userId: string, date: string): Promise<number> {
  const allPredictions = await Prediction.find({ userId, date }).lean();

  // 아직 active인 예측이 있으면 올킬 판정 보류
  if (allPredictions.some(p => p.status === 'active')) return 0;

  // 최소 2경기 이상이어야 올킬 의미 있음
  if (allPredictions.length < 2) return 0;

  const allWinCorrect = allPredictions.every(p => p.result?.winCorrect === true);
  return allWinCorrect ? ALL_KILL_BONUS : 0;
}

/**
 * 경기 1개 정산
 */
export async function settleGame(
  gameId: string,
  io: SocketIOServer
): Promise<SettlementResult> {
  const errors: string[] = [];
  const details: SettlementResult['details'] = [];

  // 이미 정산된 예측이 있는지 확인
  const settledCount = await Prediction.countDocuments({ gameId, status: 'settled' });
  const activePredictions = await Prediction.find({ gameId, status: 'active' });

  if (activePredictions.length === 0) {
    if (settledCount > 0) {
      throw new Error(`이미 정산된 경기입니다: ${gameId}`);
    }
    return { gameId, settledCount: 0, details, errors };
  }

  const game = await Game.findOne({ gameId });
  if (!game) throw new Error(`경기를 찾을 수 없습니다: ${gameId}`);
  if (game.status !== 'finished') throw new Error(`경기가 아직 종료되지 않았습니다: ${gameId}`);

  let settled = 0;

  for (const prediction of activePredictions) {
    try {
      const character = await Character.findById(prediction.characterId);
      if (!character) {
        errors.push(`캐릭터 없음: ${String(prediction.characterId)}`);
        continue;
      }

      // 1. 예측 결과 계산
      const result = calculatePredictionXp(game, prediction);

      // 2. streak 보너스
      const streakBonus = calculateStreakBonus(character.streak || 0);

      // 3. XP 적용 (netXp + streak)
      const totalXp = result.netXp + streakBonus.total;
      character.xp = Math.max(0, (character.xp || 0) + totalXp);
      character.totalPlacements = (character.totalPlacements || 0) + 1;

      // 4. 업적 재계산 (10회 배수)
      if (character.totalPlacements >= 10 && character.totalPlacements % 10 === 0) {
        try {
          const { calculateAchievements, getAchievementById } = await import('./TraitCalculator');
          const achResult = await calculateAchievements(
            String(prediction.userId),
            String(character._id)
          );

          character.activeTrait = achResult.activeTrait
            ? `${achResult.activeTrait.emoji} ${achResult.activeTrait.name}`
            : null;

          const prevEarned: string[] = (character as any).earnedAchievements || [];
          const newAchievements = achResult.earned.filter(
            (id: string) => !prevEarned.includes(id)
          );

          (character as any).earnedAchievements = achResult.earned;
          (character as any).teamAchievements = achResult.teamAchievements.map((t: any) => ({
            teamId: t.teamId,
            tier: t.tier.tier,
            count: t.count,
          }));

          if (newAchievements.length > 0) {
            const achNames = newAchievements
              .map((id: string) => {
                const a = getAchievementById(id);
                return a ? `${a.emoji} ${a.name}` : id;
              })
              .join(', ');

            sendPushToUser(
              String(prediction.userId),
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

      // 5. 예측 상태 업데이트
      prediction.status = 'settled';
      prediction.result = result;
      await prediction.save();

      settled++;
      details.push({
        predictionId: String(prediction._id),
        characterName: character.name,
        predictedWinner: prediction.predictedWinner,
        winCorrect: result.winCorrect,
        netXp: totalXp,
      });

      // 6. 올킬 보너스 확인
      const allKillXp = await checkAllKillBonus(
        String(prediction.userId),
        prediction.date
      );
      if (allKillXp > 0) {
        character.xp = (character.xp || 0) + allKillXp;
        await character.save();
      }

      // 7. 푸시 알림
      const sign = totalXp >= 0 ? '+' : '';
      let pushBody = `${character.name}: ${sign}${totalXp} XP`;

      if (result.winCorrect) pushBody = `✅ 승리 적중! ${pushBody}`;
      else pushBody = `❌ 예측 실패 ${pushBody}`;

      if (result.diffCorrect) pushBody += '\n🎯 점수차 적중!';
      if (result.totalCorrect) pushBody += '\n🎯 총득점 적중!';

      if (streakBonus.milestoneName) {
        pushBody += `\n🏆 ${streakBonus.milestoneName} +${streakBonus.total} XP`;
      } else if (streakBonus.total > 0) {
        pushBody += `\n🔥 ${character.streak}일 연속 +${streakBonus.total} XP`;
      }

      if (allKillXp > 0) {
        pushBody += `\n🔥 올킬 보너스 +${allKillXp} XP!`;
      }

      sendPushToUser(
        String(prediction.userId),
        '⚾ 정산 완료!',
        pushBody,
        { url: '/predictions' }
      ).catch((e) => console.error('[Push] Settlement push error:', e));

    } catch (err) {
      errors.push(`예측 처리 오류 (${String(prediction._id)}): ${String(err)}`);
    }
  }

  io.emit('settlement:complete', { gameId, settledCount: settled, details });

  return { gameId, settledCount: settled, details, errors };
}
