import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { StatLog } from '../models/StatLog';
import { Placement } from '../models/Placement';
import { calculateAchievements, getAllAchievements, KBO_TEAMS } from '../services/TraitCalculator';

export const charactersRouter = Router();

const VALID_ANIMALS = [
  'turtle', 'eagle', 'lion', 'dinosaur', 'dog',
  'fox', 'penguin', 'shark', 'bear', 'tiger', 'seagull',
  'dragon', 'cat', 'rabbit', 'gorilla', 'elephant',
];

// POST /api/characters
charactersRouter.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const existing = await Character.findOne({ userId });
    if (existing) return res.status(409).json({ error: '이미 캐릭터가 존재합니다' });

    const { name, animalType } = req.body as { name: string; animalType: string };
    if (!name || !animalType) return res.status(400).json({ error: 'name, animalType 필수' });
    if (!VALID_ANIMALS.includes(animalType)) {
      return res.status(400).json({ error: '유효하지 않은 동물 타입입니다' });
    }

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

// DELETE /api/characters/me
charactersRouter.delete('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    await Promise.all([
      Character.deleteOne({ userId }),
      Placement.deleteMany({ userId }),
      StatLog.deleteMany({ userId }),
    ]);

    return res.json({ message: '캐릭터가 삭제되었습니다' });
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

import { getAllBadges, getBadgeById } from '../services/TraitCalculator';

// 전체 뱃지 목록
charactersRouter.get('/badges/all', (_req: Request, res: Response) => {
  res.json(getAllBadges());
});

// 내 뱃지 정보
charactersRouter.get('/me/badges', authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await Character.findOne({ userId: req.user!.userId });
    if (!character) return res.status(404).json({ error: '캐릭터 없음' });

    const allBadges = getAllBadges();
    const earned = new Set(character.earnedBadges || []);

    const badges = allBadges.map(b => ({
      ...b,
      earned: earned.has(b.id),
    }));

    const activeBadge = character.activeTrait
      ? getBadgeById(character.activeTrait)
      : null;

    res.json({
      activeTrait: activeBadge ? {
        id: activeBadge.id,
        emoji: activeBadge.emoji,
        name: activeBadge.name,
        description: activeBadge.description,
      } : null,
      earnedCount: earned.size,
      totalCount: allBadges.length,
      badges,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
