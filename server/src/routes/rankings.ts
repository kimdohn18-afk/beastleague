import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import mongoose from 'mongoose';

export const rankingsRouter = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

rankingsRouter.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10), 100);

    const characters = await Character.find()
      .sort({ xp: -1 })
      .limit(limit)
      .select('_id userId name animalType xp totalXp activeTrait streak')
      .lean();

    const today = todayKST();
    const userIds = characters.map((c) => c.userId);

    const todayPlacements = await Placement.find({
      userId: { $in: userIds },
      date: today,
    }).select('userId').lean();

    const placedUserIds = new Set(todayPlacements.map((p) => String(p.userId)));

    const result = characters.map((c) => ({
      _id: String(c._id),
      userId: String(c.userId),
      name: c.name,
      animalType: c.animalType,
      totalXp: c.totalXp || c.xp || 0,
      currentXp: c.xp || 0,
      activeTrait: c.activeTrait,
      streak: c.streak || 0,
      placedToday: placedUserIds.has(String(c.userId)),
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

rankingsRouter.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);

    const allCharacters = await Character.find()
      .sort({ xp: -1 })
      .select('_id userId xp')
      .lean();

    const rank = allCharacters.findIndex((c) => String(c.userId) === String(userId));

    return res.json({ rank: rank === -1 ? null : rank + 1 });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
