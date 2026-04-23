// server/src/routes/predictions.ts

import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Game } from '../models/Game';
import { Prediction } from '../models/Prediction';
import { MAX_PREDICTIONS_PER_DAY } from '@beastleague/shared';

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

// POST /api/predictions — 배치 등록
predictionsRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { gameId, team, battingOrder, predictedWinner } = req.body;

    // 1. 필수값 검증
    const selectedTeam = team || predictedWinner;
    if (!gameId || !selectedTeam) {
      return res.status(400).json({ error: 'gameId와 팀 선택은 필수입니다' });
    }
    if (!battingOrder || battingOrder < 1 || battingOrder > 9) {
      return res.status(400).json({ error: '타순은 1~9 사이여야 합니다' });
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

    // 4. 팀 검증
    if (selectedTeam !== game.homeTeam && selectedTeam !== game.awayTeam) {
      return res.status(400).json({ error: '해당 경기의 팀만 선택할 수 있습니다' });
    }

    // 5. 하루 최대 배치 수 확인
    const today = todayKST();
    const todayCount = await Prediction.countDocuments({
      userId,
      date: today,
      gameId: { $ne: gameId }, // 수정 시 자기 자신 제외
    });
    if (todayCount >= MAX_PREDICTIONS_PER_DAY) {
      return res.status(400).json({
        error: `하루 최대 ${MAX_PREDICTIONS_PER_DAY}경기까지 배치 가능합니다`,
      });
    }

    // 6. 중복 확인 (같은 경기)
    const existing = await Prediction.findOne({ userId, gameId });
    if (existing) {
      if (existing.status === 'settled') {
        return res.status(400).json({ error: '이미 정산된 배치는 수정할 수 없습니다' });
      }

      // 수정
      existing.team = selectedTeam;
      existing.predictedWinner = selectedTeam;
      existing.battingOrder = battingOrder;
      // 레거시 필드 초기화
      existing.scoreDiffRange = undefined;
      existing.xpBetOnDiff = undefined;
      existing.totalRunsRange = undefined;
      existing.xpBetOnTotal = undefined;
      await existing.save();
      return res.status(200).json(existing);
    }

    // 7. 신규 생성
    const prediction = await Prediction.create({
      userId,
      characterId: character._id,
      gameId,
      date: today,
      team: selectedTeam,
      predictedWinner: selectedTeam,
      battingOrder,
    });

    return res.status(201).json(prediction);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/predictions/today — 오늘 내 배치 목록
predictionsRouter.get('/today', authenticateUser, async (req: Request, res: Response) => {
  try {
    const today = todayKST();
    const predictions = await Prediction.find({
      userId: req.user!.userId,
      date: today,
    }).lean();

    const gameIds = predictions.map((p) => p.gameId);
    const games = await Game.find({ gameId: { $in: gameIds } }).lean();
    const gameMap = new Map(games.map((g) => [g.gameId, g]));

    const result = predictions.map((p) => ({
      ...p,
      game: gameMap.get(p.gameId) || null,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/predictions/history — 과거 배치 이력
predictionsRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const predictions = await Prediction.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const gameIds = predictions.map((p) => p.gameId);
    const games = await Game.find({ gameId: { $in: gameIds } }).lean();
    const gameMap = new Map(games.map((g) => [g.gameId, g]));

    const result = predictions.map((p) => ({
      ...p,
      game: gameMap.get(p.gameId) || null,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/predictions/:gameId — 배치 취소 (경기 시작 전만)
predictionsRouter.delete('/:gameId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const prediction = await Prediction.findOne({
      userId: req.user!.userId,
      gameId: req.params.gameId,
    });

    if (!prediction) return res.status(404).json({ error: '배치를 찾을 수 없습니다' });
    if (prediction.status === 'settled') {
      return res.status(400).json({ error: '이미 정산된 배치는 취소할 수 없습니다' });
    }

    const game = await Game.findOne({ gameId: req.params.gameId });
    if (game && isGameStarted(game)) {
      return res.status(400).json({ error: '이미 시작된 경기의 배치는 취소할 수 없습니다' });
    }

    await prediction.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
