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
    const { gameId, team, groupType } = req.body as { gameId: string; team: string; groupType: string };

    const character = await Character.findOne({ userId });
    if (!character) return res.status(400).json({ error: '캐릭터가 없습니다' });

    const today = todayKST();
    const existing = await Placement.findOne({ userId, date: today });
    if (existing) return res.status(409).json({ error: '오늘 이미 배치했습니다' });

    const game = await Game.findOne({ gameId });
    if (!game) return res.status(400).json({ error: '존재하지 않는 경기입니다' });
    if (game.status !== 'scheduled') {
      return res.status(400).json({ error: '배치 가능한 경기 상태가 아닙니다 (scheduled만 가능)' });
    }

    const placement = await Placement.create({
      userId, characterId: character._id, gameId, team, groupType, date: today,
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
