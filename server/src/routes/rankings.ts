import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { StatLog } from '../models/StatLog';
import { Battle } from '../models/Battle';
import mongoose from 'mongoose';

export const rankingsRouter = Router();

type RankingType = 'level' | 'totalStats' | 'weeklyGrowth' | 'battlePoints';

async function getRanking(type: RankingType, limit: number) {
  if (type === 'level') {
    return Character.find().sort({ level: -1, xp: -1 }).limit(limit)
      .select('userId name animalType level xp stats').lean();
  }

  if (type === 'totalStats') {
    return Character.aggregate([
      { $addFields: { total: { $add: ['$stats.power','$stats.agility','$stats.skill','$stats.stamina','$stats.mind'] } } },
      { $sort: { total: -1 } },
      { $limit: limit },
      { $project: { userId:1, name:1, animalType:1, level:1, stats:1, total:1 } },
    ]);
  }

  if (type === 'weeklyGrowth') {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    return StatLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $addFields: {
        growth: { $subtract: [
          { $add: ['$after.power','$after.agility','$after.skill','$after.stamina','$after.mind'] },
          { $add: ['$before.power','$before.agility','$before.skill','$before.stamina','$before.mind'] },
        ]},
      }},
      { $group: { _id: '$userId', totalGrowth: { $sum: '$growth' } } },
      { $sort: { totalGrowth: -1 } },
      { $limit: limit },
    ]);
  }

  // battlePoints
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  return Battle.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $facet: {
      asP1: [
        { $group: { _id: '$player1.userId',
          pts: { $sum: { $switch: { branches: [
            { case: { $eq: ['$result.player1','win'] }, then: 25 },
            { case: { $eq: ['$result.player1','draw'] }, then: 15 },
          ], default: 5 } } } } },
      ],
      asP2: [
        { $group: { _id: '$player2.userId',
          pts: { $sum: { $switch: { branches: [
            { case: { $eq: ['$result.player2','win'] }, then: 25 },
            { case: { $eq: ['$result.player2','draw'] }, then: 15 },
          ], default: 5 } } } } },
      ],
    }},
    { $project: { combined: { $concatArrays: ['$asP1', '$asP2'] } } },
    { $unwind: '$combined' },
    { $group: { _id: '$combined._id', totalPts: { $sum: '$combined.pts' } } },
    { $sort: { totalPts: -1 } },
    { $limit: limit },
  ]);
}

// GET /api/rankings
rankingsRouter.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as RankingType) ?? 'level';
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10), 100);
    const data = await getRanking(type, limit);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/rankings/me
rankingsRouter.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const type = (req.query.type as RankingType) ?? 'level';
    const data = await getRanking(type, 1000) as Array<Record<string, unknown>>;
    const rank = data.findIndex((d) => {
      const id = d._id ?? d.userId;
      return String(id) === String(userId);
    });
    return res.json({ rank: rank === -1 ? null : rank + 1 });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
