import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { StatLog } from '../models/StatLog';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';
import { calculateAchievements, getAllAchievements, KBO_TEAMS } from '../services/TraitCalculator';
import mongoose from 'mongoose';

export const charactersRouter = Router();

const VALID_ANIMALS = [
  'turtle', 'eagle', 'lion', 'dinosaur', 'dog',
  'fox', 'penguin', 'shark', 'bear', 'tiger', 'seagull',
  'dragon', 'cat', 'rabbit', 'gorilla', 'elephant',
];

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

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

// GET /api/characters/me/history
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

// GET /api/characters/achievements/all
charactersRouter.get('/achievements/all', (_req: Request, res: Response) => {
  res.json(getAllAchievements());
});

// GET /api/characters/me/achievements
charactersRouter.get('/me/achievements', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });

    const { activeTrait, earned, teamAchievements, earnedCount } =
      await calculateAchievements(userId, String(character._id), { skipTraitUpdate: true });

    const allDefs = getAllAchievements();
    const achievements = allDefs.map((d: any) => ({
      ...d,
      earned: earned.includes(d.id),
    }));

    const totalCount = allDefs.length + KBO_TEAMS.length;

    return res.json({
      activeTrait,
      earnedCount,
      totalCount,
      achievements,
      teamAchievements,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/characters/me/share-reward
charactersRouter.post('/me/share-reward', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

    const existing = await StatLog.findOne({
      userId: character.userId,
      source: 'training',
      sourceId: `share-${today}`,
    });

    if (existing) {
      return res.json({
        rewarded: false,
        message: '오늘은 이미 공유 보상을 받았습니다',
        xp: character.xp,
      });
    }

    const SHARE_XP = 10;
    const xpBefore = character.xp;
    character.xp += SHARE_XP;
    await character.save();

    await StatLog.create({
      userId: character.userId,
      characterId: character._id,
      source: 'training',
      sourceId: `share-${today}`,
      before: { power: 0, agility: 0, skill: 0, stamina: 0, mind: 0 },
      after: { power: 0, agility: 0, skill: 0, stamina: 0, mind: 0 },
      xpBefore,
      xpAfter: character.xp,
      levelBefore: 0,
      levelAfter: 0,
    });

    return res.json({
      rewarded: true,
      message: '공유 보상 +10 XP!',
      xpBefore,
      xpAfter: character.xp,
      added: SHARE_XP,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// PUT /api/characters/me/active-trait
charactersRouter.put('/me/active-trait', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { traitId } = req.body as { traitId: string | null };

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    if (!traitId) {
      await Character.findByIdAndUpdate(character._id, { activeTrait: null });
      return res.json({ activeTrait: null });
    }

    const { earned, teamAchievements } = await calculateAchievements(
      userId,
      String(character._id),
      { skipTraitUpdate: true }
    );

    const isGeneralEarned = earned.includes(traitId);
    const isTeamEarned = teamAchievements.some(ta => ta.teamId === traitId);

    if (!isGeneralEarned && !isTeamEarned) {
      return res.status(400).json({ error: '아직 달성하지 않은 업적입니다' });
    }

    await Character.findByIdAndUpdate(character._id, { activeTrait: traitId });
    return res.json({ activeTrait: traitId });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// ★ GET /api/characters/:id/public — 공개 프로필 (캐릭터 + 오늘 배치만)
charactersRouter.get('/:id/public', async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    }

    const character = await Character.findById(req.params.id)
      .select('userId name animalType xp activeTrait totalPlacements streak createdAt')
      .lean();
    if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });

    // ★ 오늘 배치 조회
    const today = todayKST();
    const placement = await Placement.findOne({
      userId: character.userId,
      date: today,
    }).lean();

    // 배치한 경기 정보
    let todayGame: any = null;
    if (placement) {
      const game = await Game.findOne({ gameId: placement.gameId })
        .select('gameId homeTeam awayTeam status homeScore awayScore startTime')
        .lean();
      if (game) {
        todayGame = {
          gameId: game.gameId,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          status: game.status,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          startTime: game.startTime,
        };
      }
    }

    return res.json({
      character: {
        _id: String(character._id),
        name: character.name,
        animalType: character.animalType,
        xp: character.xp,
        activeTrait: character.activeTrait,
        totalPlacements: character.totalPlacements,
        streak: character.streak || 0,
        createdAt: character.createdAt,
      },
      todayPlacement: placement ? {
        team: placement.team,
        battingOrder: placement.battingOrder,
        predictedWinner: placement.predictedWinner,
        status: placement.status,
        isCorrect: placement.isCorrect,
        xpFromPlayer: placement.xpFromPlayer,
        xpFromPrediction: placement.xpFromPrediction,
        game: todayGame,
      } : null,
    });
  } catch (err) {
    console.error('공개 프로필 에러:', err);
    return res.status(500).json({ error: String(err) });
  }
});
