import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Battle } from '../models/Battle';

export const battlesRouter = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// GET /api/battles/today
battlesRouter.get('/today', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();
    const battles = await Battle.find({
      date: today,
      $or: [{ 'player1.userId': userId }, { 'player2.userId': userId }],
    }).lean();
    return res.json(battles);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/battles/history
battlesRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const battles = await Battle.find({
      $or: [{ 'player1.userId': userId }, { 'player2.userId': userId }],
    }).sort({ createdAt: -1 }).limit(30).lean();
    return res.json(battles);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
