import { Server as SocketIOServer } from 'socket.io';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';
import { calculatePlacementXp, XpBreakdown } from './XpCalculator';

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
    breakdown: XpBreakdown;
  }>;
  errors: string[];
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

      const totalXp = breakdown.total + xpFromPrediction;

      character.xp = (character.xp || 0) + totalXp;
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
        totalXp,
        breakdown,
      });

    } catch (err) {
      errors.push(`배치 처리 오류 (${String(placement._id)}): ${String(err)}`);
    }
  }

  io.emit('settlement:complete', { gameId, settledPlacements, details });

  return { gameId, settledPlacements, details, errors };
}

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
    totalXp: number;
    breakdown: XpBreakdown;
  }>;
  errors: string[];
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

      const totalXp = breakdown.total + xpFromPrediction;

      character.xp = (character.xp || 0) + totalXp;
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
        totalXp,
        breakdown,
      });

      // 푸시 알림 전송
      const sign = totalXp >= 0 ? '+' : '';
      sendPushToUser(
        String(placement.userId),
        '⚾ 정산 완료!',
        `${character.name}이(가) ${sign}${totalXp} XP를 획득했어요!`,
        { url: '/my-placements' }
      ).catch((e) => console.error('[Push] Settlement push error:', e));

    } catch (err) {
      errors.push(`배치 처리 오류 (${String(placement._id)}): ${String(err)}`);
    }
  }

  io.emit('settlement:complete', { gameId, settledPlacements, details });

  return { gameId, settledPlacements, details, errors };
}
