import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Game } from '../models/Game';
import { Placement } from '../models/Placement';

export const placementsRouter = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// POST /api/placements
placementsRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { gameId, team, battingOrder, predictedWinner } = req.body as {
      gameId: string;
      team: string;
      battingOrder: number;
      predictedWinner: string;
    };

    if (!gameId || !team || !battingOrder || !predictedWinner) {
      return res.status(400).json({ error: '모든 항목을 선택해주세요' });
    }

    if (battingOrder < 1 || battingOrder > 9) {
      return res.status(400).json({ error: '타순은 1~9번입니다' });
    }

    const character = await Character.findOne({ userId });
    if (!character) return res.status(400).json({ error: '캐릭터가 없습니다' });

    const today = todayKST();
  const existing = await Placement.findOne({ userId, date: today });
    if (existing) {
      // 이미 정산된 배치는 수정 불가
      if (existing.status === 'settled') {
        return res.status(400).json({ error: '이미 정산된 배치는 수정할 수 없습니다' });
      }
      // 경기 시작 전이면 수정 가능
      existing.gameId = gameId;
      existing.team = team;
      existing.battingOrder = battingOrder;
      existing.predictedWinner = predictedWinner;
      await existing.save();
      return res.status(200).json(existing);
    }
    
    const game = await Game.findOne({ gameId });
    if (!game) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
    if (game.status !== 'scheduled') {
      return res.status(400).json({ error: '이미 시작된 경기입니다' });
    }

    const placement = await Placement.create({
      userId,
      characterId: character._id,
      gameId,
      team,
      battingOrder,
      predictedWinner,
      date: today,
    });

    return res.status(201).json(placement);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/placements/today
placementsRouter.get('/today', authenticateUser, async (req: Request, res: Response) => {
  try {
    const today = todayKST();
    const placement = await Placement.findOne({ userId: req.user!.userId, date: today }).lean();
    return res.json(placement ?? null);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/placements/history
placementsRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const list = await Placement.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 }).limit(30).lean();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
