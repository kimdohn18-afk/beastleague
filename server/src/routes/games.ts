import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Game } from '../models/Game';
import { Placement } from '../models/Placement';

export const gamesRouter = Router();

// GET /api/games?date=YYYY-MM-DD
gamesRouter.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date 파라미터가 필요합니다' });
    const games = await Game.find({ date: String(date) }).lean();
    return res.json(games);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/games/:gameId
gamesRouter.get('/:gameId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId }).lean();
    if (!game) return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    return res.json(game);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/games/:gameId/popularity
gamesRouter.get('/:gameId/popularity', authenticateUser, async (req: Request, res: Response) => {
  try {
    const result = await Placement.aggregate([
      { $match: { gameId: req.params.gameId } },
      { $group: { _id: { team: '$team', groupType: '$groupType' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
