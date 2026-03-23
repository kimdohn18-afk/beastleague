import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { StatLog } from '../models/StatLog';

export const charactersRouter = Router();

// POST /api/characters
charactersRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const existing = await Character.findOne({ userId });
    if (existing) return res.status(409).json({ error: '이미 캐릭터가 존재합니다' });

    const { name, animalType } = req.body as { name: string; animalType: string };
    if (!name || !animalType) return res.status(400).json({ error: 'name, animalType 필수' });

    const character = await Character.create({ userId, name, animalType });
    return res.status(201).json(character);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/characters/me
charactersRouter.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await Character.findOne({ userId: req.user!.userId }).lean();
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });
    return res.json(character);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/characters/me/history?skip=0&limit=50
charactersRouter.get('/me/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const skip = parseInt(String(req.query.skip ?? '0'), 10);
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 50);
    const logs = await StatLog.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
