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

// GET /api/characters/achievements/all — 전체 업적 목록
charactersRouter.get('/achievements/all', (_req: Request, res: Response) => {
  res.json(getAllAchievements());
});

// GET /api/characters/me/achievements — 내 업적 정보
charactersRouter.get('/me/achievements', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });

    const { activeTrait, earned, teamAchievements, earnedCount } =
      await calculateAchievements(userId, String(character._id), { skipTraitUpdate: true });

    const allDefs = getAllAchievements();
    const achievements = allDefs.map(d => ({
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

// POST /api/characters/me/share-reward — 하루 1회 공유 보상 (10 XP)
charactersRouter.post('/me/share-reward', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    // 오늘 날짜 (KST)
    const todayKST = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

    // 이미 오늘 보상 받았는지 체크
    const existing = await StatLog.findOne({
      userId: character.userId,
      source: 'training',
      sourceId: `share-${todayKST}`,
    });

    if (existing) {
      return res.json({
        rewarded: false,
        message: '오늘은 이미 공유 보상을 받았습니다',
        xp: character.xp,
      });
    }

    // 10 XP 부여
    const SHARE_XP = 10;
    const xpBefore = character.xp;
    character.xp += SHARE_XP;
    await character.save();

    // 로그 기록
    await StatLog.create({
      userId: character.userId,
      characterId: character._id,
      source: 'training',
      sourceId: `share-${todayKST}`,
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

// PUT /api/characters/me/active-trait — 대표 업적 선택
charactersRouter.put('/me/active-trait', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { traitId } = req.body as { traitId: string | null };

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    // null이면 해제
    if (!traitId) {
      character.activeTrait = null;
      await character.save();
      return res.json({ activeTrait: null });
    }

    // 달성한 업적인지 검증 — skipTraitUpdate로 activeTrait 덮어쓰기 방지
    const { earned, teamAchievements } = await calculateAchievements(
      userId, 
      String(character._id),
      { skipTraitUpdate: true }
    );
    
    // 일반 업적에서 찾기
    const isGeneralEarned = earned.includes(traitId);
    
    // 팀 업적에서 찾기
    const isTeamEarned = teamAchievements.some(ta => ta.teamId === traitId);
    
    if (!isGeneralEarned && !isTeamEarned) {
      return res.status(400).json({ error: '아직 달성하지 않은 업적입니다' });
    }

    // 검증 통과 후 저장
    character.activeTrait = traitId;
    await character.save();

    return res.json({ activeTrait: traitId });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/characters/:id/public — 공개 프로필 (인증 불필요)
charactersRouter.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const character = await Character.findById(req.params.id)
      .select('userId name animalType xp activeTrait totalPlacements createdAt')
      .lean();
    if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });

    const { activeTrait, earned, teamAchievements, earnedCount } =
      await calculateAchievements(String(character.userId), String(character._id), { skipTraitUpdate: true });

    const allDefs = getAllAchievements();
    const totalCount = allDefs.length + KBO_TEAMS.length;

    return res.json({
      character: {
        _id: character._id,
        name: character.name,
        animalType: character.animalType,
        xp: character.xp,
        activeTrait: character.activeTrait,
        totalPlacements: character.totalPlacements,
        createdAt: character.createdAt,
      },
      achievements: {
        activeTrait,
        earnedCount,
        totalCount,
        earned: earned.map(id => {
          const def = allDefs.find(d => d.id === id);
          return def ? { id: def.id, emoji: def.emoji, name: def.name } : null;
        }).filter(Boolean),
        teamAchievements: teamAchievements.map(ta => ({
          teamId: ta.teamId,
          teamName: ta.teamName,
          teamEmoji: ta.teamEmoji,
          tier: ta.tier.tier,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
