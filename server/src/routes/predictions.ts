// server/src/routes/predictions.ts

import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Game } from '../models/Game';
import { Prediction } from '../models/Prediction';
import { MAX_BET_PER_GAME, MAX_PREDICTIONS_PER_DAY } from '@beastleague/shared';

export const predictionsRouter = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function nowKST(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

function isGameStarted(game: any): boolean {
  if (game.status !== 'scheduled') return true;
  if (game.startTime && game.date) {
    try {
      const [hour, minute] = game.startTime.split(':').map(Number);
      const now = nowKST();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      const currentDate = now.toISOString().slice(0, 10);
      if (currentDate === game.date) {
        if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) {
          return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

// POST /api/predictions — 예측 등록
predictionsRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      gameId,
      predictedWinner,
      scoreDiffRange,
      xpBetOnDiff,
      totalRunsRange,
      xpBetOnTotal,
    } = req.body;

    // 1. 필수값 검증
    if (!gameId || !predictedWinner) {
      return res.status(400).json({ error: 'gameId와 predictedWinner는 필수입니다' });
    }

    // 2. 캐릭터 확인
    const character = await Character.findOne({ userId });
    if (!character) return res.status(400).json({ error: '캐릭터가 없습니다' });

    // 3. 경기 확인
    const game = await Game.findOne({ gameId });
    if (!game) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
    if (isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기입니다' });
    }

    // 4. 승리 예측 대상 검증
    if (predictedWinner !== game.homeTeam && predictedWinner !== game.awayTeam) {
      return res.status(400).json({ error: '해당 경기의 팀만 선택할 수 있습니다' });
    }

    // 5. 하루 최대 예측 수 확인
    const today = todayKST();
    const todayCount = await Prediction.countDocuments({ userId, date: today });
    if (todayCount >= MAX_PREDICTIONS_PER_DAY) {
      return res.status(400).json({ error: `하루 최대 ${MAX_PREDICTIONS_PER_DAY}경기까지 예측 가능합니다` });
    }

    // 6. 베팅 XP 검증
    const totalBet = (xpBetOnDiff || 0) + (xpBetOnTotal || 0);
    if (totalBet > MAX_BET_PER_GAME) {
      return res.status(400).json({ error: `한 경기당 최대 ${MAX_BET_PER_GAME} XP까지 베팅 가능합니다` });
    }

    // 기존 다른 경기 베팅 합산도 확인
    const existingBets = await Prediction.aggregate([
      { $match: { userId: new Types.ObjectId(userId), date: today, status: 'active' } },
      { $group: { _id: null, total: { $sum: { $add: [{ $ifNull: ['$xpBetOnDiff', 0] }, { $ifNull: ['$xpBetOnTotal', 0] }] } } } },
    ]);
    const alreadyBet = existingBets.length > 0 ? existingBets[0].total : 0;

    if (alreadyBet + totalBet > (character.xp || 0)) {
      return res.status(400).json({ error: 'XP가 부족합니다' });
    }

    // 7. 점수차/총득점 범위 검증
    if (scoreDiffRange && !['1-2', '3-4', '5+'].includes(scoreDiffRange)) {
      return res.status(400).json({ error: '유효하지 않은 점수차 범위입니다' });
    }
    if (totalRunsRange && !['low', 'normal', 'high'].includes(totalRunsRange)) {
      return res.status(400).json({ error: '유효하지 않은 총득점 범위입니다' });
    }
    if (scoreDiffRange && (!xpBetOnDiff || xpBetOnDiff <= 0)) {
      return res.status(400).json({ error: '점수차 예측 시 베팅 XP를 입력해주세요' });
    }
    if (totalRunsRange && (!xpBetOnTotal || xpBetOnTotal <= 0)) {
      return res.status(400).json({ error: '총득점 예측 시 베팅 XP를 입력해주세요' });
    }

    // 8. 중복 예측 확인 (같은 경기)
    const existing = await Prediction.findOne({ userId, gameId });
    if (existing) {
      if (existing.status === 'settled') {
        return res.status(400).json({ error: '이미 정산된 예측은 수정할 수 없습니다' });
      }

      // 수정
      existing.predictedWinner = predictedWinner;
      existing.scoreDiffRange = scoreDiffRange;
      existing.xpBetOnDiff = xpBetOnDiff;
      existing.totalRunsRange = totalRunsRange;
      existing.xpBetOnTotal = xpBetOnTotal;
      await existing.save();
      return res.status(200).json(existing);
    }

    // 9. 신규 생성
    const prediction = await Prediction.create({
      userId,
      characterId: character._id,
      gameId,
      date: today,
      predictedWinner,
      scoreDiffRange,
      xpBetOnDiff,
      totalRunsRange,
      xpBetOnTotal,
    });

    return res.status(201).json(prediction);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/predictions/today — 오늘 내 예측 목록
predictionsRouter.get('/today', authenticateUser, async (req: Request, res: Response) => {
  try {
    const today = todayKST();
    const predictions = await Prediction.find({
      userId: req.user!.userId,
      date: today,
    }).lean();

    // 각 예측에 경기 정보 붙이기
    const gameIds = predictions.map(p => p.gameId);
    const games = await Game.find({ gameId: { $in: gameIds } }).lean();
    const gameMap = new Map(games.map(g => [g.gameId, g]));

    const result = predictions.map(p => ({
      ...p,
      game: gameMap.get(p.gameId) || null,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/predictions/history — 과거 예측 이력
predictionsRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const predictions = await Prediction.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const gameIds = predictions.map(p => p.gameId);
    const games = await Game.find({ gameId: { $in: gameIds } }).lean();
    const gameMap = new Map(games.map(g => [g.gameId, g]));

    const result = predictions.map(p => ({
      ...p,
      game: gameMap.get(p.gameId) || null,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/predictions/:gameId — 예측 취소 (경기 시작 전만)
predictionsRouter.delete('/:gameId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const prediction = await Prediction.findOne({
      userId: req.user!.userId,
      gameId: req.params.gameId,
    });

    if (!prediction) return res.status(404).json({ error: '예측을 찾을 수 없습니다' });
    if (prediction.status === 'settled') {
      return res.status(400).json({ error: '이미 정산된 예측은 취소할 수 없습니다' });
    }

    const game = await Game.findOne({ gameId: req.params.gameId });
    if (game && isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기의 예측은 취소할 수 없습니다' });
    }

    await prediction.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
