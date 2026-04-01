import { Server as SocketIOServer } from 'socket.io';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';
import { calculatePlacementXp } from './XpCalculator';

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
    totalXp: number;
  }>;
  errors: string[];
}

export async function settleGame(
  gameId: string,
  io: SocketIOServer
): Promise<SettlementResult> {
  const errors: string[] = [];
  const details: SettlementResult['details'] = [];

  // 이미 정산된 경기인지 확인
  const settledCount = await Placement.countDocuments({ gameId, status: 'settled' });
  const activePlacements = await Placement.find({ gameId, status: 'active' });

  if (activePlacements.length === 0) {
    if (settledCount > 0) {
      throw new Error(`이미 정산된 경기입니다: ${gameId}`);
    }
    return { gameId, settledPlacements: 0, details, errors };
  }

  // 경기 데이터 가져오기
  const game = await Game.findOne({ gameId });
  if (!game) throw new Error(`경기를 찾을 수 없습니다: ${gameId}`);
  if (game.status !== 'finished') throw new Error(`경기가 아직 종료되지 않았습니다: ${gameId}`);

  // 승리팀 판별
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

      // XP 계산 (선수 성적 기반)
      const xpBreakdown = calculatePlacementXp(
        game,
        placement.team,
        placement.battingOrder
      );
      const xpFromPlayer = xpBreakdown.total - xpBreakdown.teamResult;

      // 승패 예측 XP
      let xpFromPrediction = 0;
      let isCorrect = false;
      if (winner && placement.predictedWinner === winner) {
        xpFromPrediction = 30;
        isCorrect = true;
      }

      // 전체 XP = 선수 성적 XP + 팀 결과 XP + 예측 XP
      const totalXp = xpBreakdown.total + xpFromPrediction;

      // 캐릭터에 XP 적용
      character.xp = (character.xp || 0) + totalXp;
      await character.save();

      // Placement 업데이트
      placement.status = 'settled';
      placement.isCorrect = isCorrect;
      placement.xpFromPlayer = xpFromPlayer + xpBreakdown.teamResult;
      placement.xpFromPrediction = xpFromPrediction;
      await placement.save();

      settledPlacements++;
      details.push({
        placementId: String(placement._id),
        characterName: character.name,
        team: placement.team,
        battingOrder: placement.battingOrder,
        xpFromPlayer: xpFromPlayer + xpBreakdown.teamResult,
        xpFromPrediction,
        totalXp,
      });

    } catch (err) {
      errors.push(`배치 처리 오류 (${String(placement._id)}): ${String(err)}`);
    }
  }

  // 실시간 알림
  io.emit('settlement:complete', { gameId, settledPlacements, details });

  return { gameId, settledPlacements, details, errors };
}
