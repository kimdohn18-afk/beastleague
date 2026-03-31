import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';

export interface SettlementResult {
  gameId: string;
  settledPlacements: number;
  errors: string[];
}

export async function settleGame(
  gameId: string,
  io: SocketIOServer
): Promise<SettlementResult> {
  const errors: string[] = [];

  const activePlacements = await Placement.find({ gameId, status: 'active' });

  if (activePlacements.length === 0) {
    const settledCount = await Placement.countDocuments({ gameId, status: 'settled' });
    if (settledCount > 0) {
      throw new Error(`이미 정산된 경기입니다: ${gameId}`);
    }
    return { gameId, settledPlacements: 0, errors };
  }

  const game = await Game.findOne({ gameId });
  if (!game) throw new Error(`경기를 찾을 수 없습니다: ${gameId}`);

  // 승리팀 판별
  let winner = '';
  if (game.homeScore !== undefined && game.awayScore !== undefined) {
    if (game.homeScore > game.awayScore) winner = game.homeTeam;
    else if (game.awayScore > game.homeScore) winner = game.awayTeam;
  }

  let settledPlacements = 0;

  for (const placement of activePlacements) {
    try {
      const character = await Character.findById(placement.characterId);
      if (!character) {
        errors.push(`캐릭터 없음: ${String(placement.characterId)}`);
        continue;
      }

      // 승패 예측 XP
      let xpFromPrediction = 0;
      let isCorrect = false;
      if (winner && placement.predictedWinner === winner) {
        xpFromPrediction = 30;
        isCorrect = true;
      }

      // 선수 성적 XP (추후 개별 타자 데이터 연동 시 계산)
      const xpFromPlayer = 0;

      // XP 적용
      const totalXp = xpFromPlayer + xpFromPrediction;
      character.xp = (character.xp || 0) + totalXp;
      await character.save();

      // Placement 업데이트
      placement.status = 'settled';
      placement.isCorrect = isCorrect;
      placement.xpFromPlayer = xpFromPlayer;
      placement.xpFromPrediction = xpFromPrediction;
      await placement.save();

      settledPlacements++;
    } catch (err) {
      errors.push(`배치 처리 오류 (${String(placement._id)}): ${String(err)}`);
    }
  }

  io.emit('settlement:complete', { gameId, settledPlacements });

  return { gameId, settledPlacements, errors };
}
