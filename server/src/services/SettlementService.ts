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
    team: string;
    battingOrder?: number;
    winCorrect: boolean;
    netXp: number;
    playerName?: string;
  }>;
  errors: string[];
}

/**
 * streak 보너스 계산
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
 * 올킬 보너스 확인
 */
async function checkAllKillBonus(userId: string, date: string): Promise<number> {
  const allPredictions = await Prediction.find({ userId, date }).lean();
  if (allPredictions.some((p) => p.status === 'active')) return 0;
  if (allPredictions.length < 2) return 0;
  const allWinCorrect = allPredictions.every((p) => p.result?.winCorrect === true);
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
  if (game.status !== 'finished')
    throw new Error(`경기가 아직 종료되지 않았습니다: ${gameId}`);

  let settled = 0;

  for (const prediction of activePredictions) {
    try {
      const character = await Character.findById(prediction.characterId);
      if (!character) {
        errors.push(`캐릭터 없음: ${String(prediction.characterId)}`);
        continue;
      }

      // 1. XP 계산 (XpCalculator가 타순/레거시 모두 처리)
      const result = calculatePredictionXp(game, prediction);

      // 2. streak 보너스
      const streakBonus = calculateStreakBonus(character.streak || 0);

      // 3. XP 적용
      const totalXp = result.netXp + streakBonus.total;
      if (totalXp > 0) {
        character.totalXp = (character.totalXp || 0) + totalXp;
      }
      character.currentXp = Math.max(0, (character.currentXp || 0) + totalXp);
      character.xp = character.totalXp;
      character.totalPlacements = (character.totalPlacements || 0) + 1;

      // 4. 업적 재계산 (10회 배수)
      if (
        character.totalPlacements >= 10 &&
        character.totalPlacements % 10 === 0
      ) {
        try {
          const { calculateAchievements, getAchievementById } = await import(
            './TraitCalculator'
          );
          const achResult = await calculateAchievements(
            String(prediction.userId),
            String(character._id)
          );

          character.activeTrait = achResult.activeTrait
            ? `${achResult.activeTrait.emoji} ${achResult.activeTrait.name}`
            : null;

          const prevEarned: string[] =
            (character as any).earnedAchievements || [];
          const newAchievements = achResult.earned.filter(
            (id: string) => !prevEarned.includes(id)
          );

          (character as any).earnedAchievements = achResult.earned;

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
            ).catch((e) =>
              console.error('[Push] Achievement push error:', e)
            );
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
        team: prediction.team || prediction.predictedWinner,
        battingOrder: prediction.battingOrder,
        winCorrect: result.winCorrect,
        netXp: totalXp,
        playerName: result.batterResult?.playerName,
      });

      // 6. 올킬 보너스 확인
      const allKillXp = await checkAllKillBonus(
        String(prediction.userId),
        prediction.date
      );
      if (allKillXp > 0) {
        character.totalXp = (character.totalXp || 0) + allKillXp;
        character.currentXp = (character.currentXp || 0) + allKillXp;
        character.xp = character.totalXp;
        await character.save();
      }

      // 7. 푸시 알림
      const sign = totalXp >= 0 ? '+' : '';
      let pushBody = '';

      // 타순 배치인 경우
      if (prediction.battingOrder && result.batterResult?.playerName) {
        const br = result.batterResult;
        const statsLine = [
          `${br.atBats}타수 ${br.hits}안타`,
          br.homeRuns > 0 ? `${br.homeRuns}홈런` : null,
          br.rbi > 0 ? `${br.rbi}타점` : null,
          br.stolenBases > 0 ? `${br.stolenBases}도루` : null,
        ]
          .filter(Boolean)
          .join(' ');

        pushBody = `${br.playerName} (${prediction.battingOrder}번): ${statsLine}`;
        pushBody += `\n${character.name}: ${sign}${totalXp} XP`;

        if (result.xpFromPlayer !== undefined && result.xpFromPlayer > 0) {
          pushBody += `\n⚾ 타자 성적 +${result.xpFromPlayer}`;
        }
        if (result.xpFromTeamWin && result.xpFromTeamWin > 0) {
          pushBody += `\n✅ 팀 승리 +${result.xpFromTeamWin}`;
        }
        if (result.xpFromWinPredict !== undefined) {
          if (result.xpFromWinPredict > 0) {
            pushBody += `\n🎯 승리 적중 +${result.xpFromWinPredict}`;
          } else if (result.xpFromWinPredict < 0) {
            pushBody += `\n❌ 승리 예측 실패 ${result.xpFromWinPredict}`;
          }
        }
      } else {
        // 레거시 스코어 기반
        pushBody = `${character.name}: ${sign}${totalXp} XP`;
        if (result.winCorrect) pushBody = `✅ 승리 적중! ${pushBody}`;
        else pushBody = `❌ 예측 실패 ${pushBody}`;
        if (result.diffCorrect) pushBody += '\n🎯 점수차 적중!';
        if (result.totalCorrect) pushBody += '\n🎯 총득점 적중!';
      }

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
      errors.push(
        `배치 처리 오류 (${String(prediction._id)}): ${String(err)}`
      );
    }
  }

  io.emit('settlement:complete', { gameId, settledCount: settled, details });

  return { gameId, settledCount: settled, details, errors };
}
