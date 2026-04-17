import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';
import { Like } from '../models/Like';
import { Feed } from '../models/Feed';
import {
  calculateAchievements,
  getAllAchievements,
} from '../services/TraitCalculator';

const router = Router();

const VALID_ANIMALS = [
  'turtle', 'eagle', 'lion', 'dinosaur', 'dog',
  'fox', 'penguin', 'shark', 'bear', 'tiger',
  'seagull', 'dragon', 'cat', 'rabbit', 'gorilla', 'elephant',
];

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/* ───── POST / — 캐릭터 생성 ───── */
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, animalType } = req.body;

    if (!name || !animalType) {
      return res.status(400).json({ error: '이름과 동물 타입이 필요합니다' });
    }
    if (name.length > 10) {
      return res.status(400).json({ error: '이름은 10자 이내로 입력해주세요' });
    }
    if (!VALID_ANIMALS.includes(animalType)) {
      return res.status(400).json({ error: '유효하지 않은 동물 타입입니다' });
    }

    const existing = await Character.findOne({ userId });
    if (existing) {
      return res.status(400).json({ error: '이미 캐릭터가 있습니다' });
    }

    const character = await Character.create({ userId, name, animalType });
    res.status(201).json(character);
  } catch (err) {
    console.error('Character create error:', err);
    res.status(500).json({ error: '캐릭터 생성 실패' });
  }
});

/* ───── GET /me — 내 캐릭터 조회 ───── */
router.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }
    res.json(character);
  } catch (err) {
    console.error('Character fetch error:', err);
    res.status(500).json({ error: '캐릭터 조회 실패' });
  }
});

/* ───── DELETE /me — 캐릭터 삭제 ───── */
router.delete('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    await Placement.deleteMany({ userId });
    await Like.deleteMany({
      $or: [{ fromUserId: userId }, { toCharacterId: character._id }],
    });
    await Feed.deleteMany({
      $or: [{ fromUserId: userId }, { toCharacterId: character._id }],
    });
    await Character.findByIdAndDelete(character._id);

    res.json({ message: '캐릭터가 삭제되었습니다' });
  } catch (err) {
    console.error('Character delete error:', err);
    res.status(500).json({ error: '캐릭터 삭제 실패' });
  }
});

/* ───── GET /me/history — 내 스탯 로그 ───── */
router.get('/me/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const placements = await Placement.find({ userId, status: 'settled' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(placements);
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: '히스토리 조회 실패' });
  }
});

/* ───── GET /achievements/all — 전체 업적 목록 ───── */
router.get('/achievements/all', async (_req: Request, res: Response) => {
  try {
    const all = getAllAchievements();
    res.json(all);
  } catch (err) {
    console.error('Achievements list error:', err);
    res.status(500).json({ error: '업적 목록 조회 실패' });
  }
});

/* ───── GET /me/achievements — 내 업적 ───── */
router.get('/me/achievements', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const result = await calculateAchievements(
      String(character.userId),
      String(character._id),
      { skipTraitUpdate: true },
    );

    // 전체 업적 목록을 가져와서 earned 여부를 포함한 형태로 가공
    const allAchievements = getAllAchievements();
    const earnedSet = new Set(result.earned);

    const achievements = allAchievements.map(a => ({
      ...a,
      earned: earnedSet.has(a.id),
    }));

    res.json({
      activeTrait: result.activeTrait,
      earnedCount: result.earnedCount,
      totalCount: allAchievements.length,
      achievements,
      teamAchievements: result.teamAchievements,
    });
  } catch (err) {
    console.error('My achievements error:', err);
    res.status(500).json({ error: '업적 조회 실패' });
  }
});

/* ───── PUT /me/active-trait — 대표 업적 변경 ───── */
router.put('/me/active-trait', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { traitId } = req.body;

    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    if (traitId === null || traitId === undefined) {
      await Character.findByIdAndUpdate(character._id, { activeTrait: null });
      return res.json({ activeTrait: null });
    }

    const earnedGeneral = (character.earnedAchievements || []).includes(traitId);
    const earnedTeam = (character.teamAchievements || []).some(
      (ta: any) => `team_${ta.teamId}_${ta.tier}` === traitId,
    );

    if (!earnedGeneral && !earnedTeam) {
      return res.status(400).json({ error: '획득하지 않은 업적은 설정할 수 없습니다' });
    }

    await Character.findByIdAndUpdate(character._id, { activeTrait: traitId });
    res.json({ activeTrait: traitId });
  } catch (err) {
    console.error('Active trait update error:', err);
    res.status(500).json({ error: '대표 업적 변경 실패' });
  }
});

/* ───── POST /me/share-reward — 공유 보상 ───── */
router.post('/me/share-reward', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const today = todayKST();
    const lastShare = (character as any).lastShareDate;
    if (lastShare === today) {
      return res.status(400).json({ error: '오늘 이미 공유 보상을 받았습니다' });
    }

    await Character.findByIdAndUpdate(character._id, {
      $inc: { xp: 10 },
      lastShareDate: today,
    });

    res.json({ reward: 10, message: '공유 보상 10 XP 지급!' });
  } catch (err) {
    console.error('Share reward error:', err);
    res.status(500).json({ error: '공유 보상 실패' });
  }
});

/* ───── GET /me/evolution — 내 진화 정보 ───── */
router.get('/me/evolution', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const STAGES = [
      { stage: 1, name: '아기',  minXp: 0,     badge: '🥚' },
      { stage: 2, name: '성장',  minXp: 300,   badge: '⭐' },
      { stage: 3, name: '성숙',  minXp: 1000,  badge: '🔥' },
      { stage: 4, name: '전설',  minXp: 3000,  badge: '👑' },
      { stage: 5, name: '신화',  minXp: 10000, badge: '💎' },
    ];

    let current = STAGES[0];
    for (const s of STAGES) {
      if (character.xp >= s.minXp) current = s;
    }
    const next = STAGES.find(s => character.xp < s.minXp) || null;

    res.json({
      xp: character.xp,
      currentStage: current,
      nextStage: next,
      xpToNext: next ? next.minXp - character.xp : 0,
    });
  } catch (err) {
    console.error('Evolution info error:', err);
    res.status(500).json({ error: '진화 정보 조회 실패' });
  }
});

/* ───── PUT /me/animal — 캐릭터 동물 변경 (XP 소모) ───── */
router.put('/me/animal', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { animalType } = req.body;

    const ALL_ANIMALS = [
      'turtle', 'eagle', 'lion', 'dinosaur', 'dog',
      'fox', 'penguin', 'shark', 'bear', 'tiger',
      'seagull', 'dragon', 'cat', 'rabbit', 'gorilla', 'elephant',
    ];

    if (!animalType || !ALL_ANIMALS.includes(animalType)) {
      return res.status(400).json({ error: '유효하지 않은 동물 타입입니다' });
    }

    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    if (character.animalType === animalType) {
      return res.status(400).json({ error: '이미 같은 동물입니다' });
    }

    const COST = 100;
    if (character.xp < COST) {
      return res.status(400).json({
        error: `XP가 부족합니다 (${COST} XP 필요, 현재 ${character.xp} XP)`,
        code: 'insufficientXp',
      });
    }

    await Character.findByIdAndUpdate(character._id, {
      animalType,
      $inc: { xp: -COST },
    });

    const updated = await Character.findById(character._id);

    res.json({
      success: true,
      cost: COST,
      character: {
        animalType: updated?.animalType,
        xp: updated?.xp,
        name: updated?.name,
      },
    });
  } catch (err) {
    console.error('Animal change error:', err);
    res.status(500).json({ error: '캐릭터 변경 실패' });
  }
});


/* ───── GET /:id/public — 공개 프로필 (인증 불필요) ───── */
router.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '잘못된 ID입니다' });
    }

    const character = await Character.findById(id).select(
      'userId name animalType xp activeTrait totalPlacements streak totalLikes totalFeeds createdAt',
    );
    if (!character) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    }

    const today = todayKST();
    let todayPlacement = null;

    const placement = await Placement.findOne({
      userId: character.userId,
      date: today,
    }).lean();

    if (placement) {
      const game = await Game.findOne({ gameId: (placement as any).gameId })
        .select('gameId homeTeam awayTeam status scores startTime')
        .lean();

      todayPlacement = {
        team: (placement as any).team,
        battingOrder: (placement as any).battingOrder,
        predictedWinner: (placement as any).predictedWinner,
        status: (placement as any).status,
        isCorrect: (placement as any).isCorrect,
        xpFromPlayer: (placement as any).xpFromPlayer,
        xpFromPrediction: (placement as any).xpFromPrediction,
        game: game || null,
      };
    }

    res.json({
      character: {
        id: String(character._id),
        name: character.name,
        animalType: character.animalType,
        xp: character.xp,
        activeTrait: character.activeTrait,
        totalPlacements: character.totalPlacements || 0,
        streak: character.streak || 0,
        totalLikes: character.totalLikes || 0,
        totalFeeds: character.totalFeeds || 0,
        createdAt: character.createdAt,
      },
      todayPlacement,
    });
  } catch (err) {
    console.error('Public profile error:', err);
    res.status(500).json({ error: '프로필 조회 실패' });
  }
});

/* ───── POST /:id/like — 좋아요 ───── */
router.post('/:id/like', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetId = req.params.id;
    const today = todayKST();

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: '잘못된 ID입니다' });
    }

    const targetChar = await Character.findById(targetId);
    if (!targetChar) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    }

    if (String(targetChar.userId) === userId) {
      return res.status(400).json({ error: '자신에게는 좋아요를 할 수 없습니다' });
    }

    const alreadyLiked = await Like.findOne({
      fromUserId: userId,
      toCharacterId: targetId,
      date: today,
    });
    if (alreadyLiked) {
      return res.status(400).json({ error: '오늘 이미 좋아요를 눌렀어요', code: 'alreadyLiked' });
    }

    await Like.create({ fromUserId: userId, toCharacterId: targetId, date: today });
    await Character.findByIdAndUpdate(targetId, { $inc: { totalLikes: 1 } });

    const updated = await Character.findById(targetId);
    res.json({ liked: true, totalLikes: updated?.totalLikes || 0 });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: '좋아요 실패' });
  }
});

/* ───── GET /:id/like-status — 좋아요 상태 ───── */
router.get('/:id/like-status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetId = req.params.id;
    const today = todayKST();

    const liked = await Like.findOne({
      fromUserId: userId,
      toCharacterId: targetId,
      date: today,
    });

    res.json({ liked: !!liked });
  } catch (err) {
    console.error('Like status error:', err);
    res.status(500).json({ error: '상태 확인 실패' });
  }
});

/* ───── POST /:id/feed — 밥주기 ───── */
router.post('/:id/feed', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetId = req.params.id;
    const today = todayKST();

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: '잘못된 ID입니다' });
    }

    const myChar = await Character.findOne({ userId });
    if (!myChar) {
      return res.status(404).json({ error: '내 캐릭터가 없습니다' });
    }

    const targetChar = await Character.findById(targetId);
    if (!targetChar) {
      return res.status(404).json({ error: '대상 캐릭터를 찾을 수 없습니다' });
    }

    const isSelf = String(myChar._id) === String(targetChar._id);
    const xpCost = isSelf ? 0 : 5;
    const xpGiven = 3;

    if (!isSelf && myChar.xp < xpCost) {
      return res.status(400).json({ error: 'XP가 부족합니다 (5 XP 필요)' });
    }

    const alreadyFed = await Feed.findOne({
      fromUserId: userId,
      toCharacterId: targetChar._id,
      date: today,
    });
    if (alreadyFed) {
      return res.status(400).json({ error: '오늘 이미 밥을 줬어요', code: 'alreadyFed' });
    }

    let remainingFeeds = 3;
    if (!isSelf) {
      const todayFeedCount = await Feed.countDocuments({
        fromUserId: userId,
        date: today,
        isSelf: false,
      });
      if (todayFeedCount >= 3) {
        return res.status(400).json({
          error: '오늘 밥주기 횟수를 모두 사용했어요 (3회)',
          code: 'limitReached',
        });
      }
      remainingFeeds = 3 - todayFeedCount - 1;
    }

    await Feed.create({
      fromUserId: userId,
      toCharacterId: targetChar._id,
      date: today,
      xpCost,
      xpGiven,
      isSelf,
    });

    if (!isSelf) {
      await Character.findByIdAndUpdate(myChar._id, { $inc: { xp: -xpCost } });
    }

    await Character.findByIdAndUpdate(targetChar._id, {
      $inc: { xp: xpGiven, totalFeeds: 1 },
    });

    const updatedMyChar = await Character.findById(myChar._id);
    const updatedTarget = await Character.findById(targetChar._id);

    res.json({
      fed: true,
      isSelf,
      cost: xpCost,
      given: xpGiven,
      myXp: updatedMyChar?.xp ?? myChar.xp,
      theirXp: updatedTarget?.xp ?? targetChar.xp,
      totalFeeds: updatedTarget?.totalFeeds ?? 0,
      remainingFeeds: isSelf ? null : remainingFeeds,
    });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: '밥주기 실패' });
  }
});

/* ───── GET /:id/feed-status — 밥주기 상태 확인 ───── */
router.get('/:id/feed-status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetId = req.params.id;
    const today = todayKST();

    const fed = await Feed.findOne({
      fromUserId: userId,
      toCharacterId: targetId,
      date: today,
    });

    const todayFeedCount = await Feed.countDocuments({
      fromUserId: userId,
      date: today,
      isSelf: false,
    });

    res.json({
      fed: !!fed,
      remainingFeeds: Math.max(0, 3 - todayFeedCount),
    });
  } catch (err) {
    console.error('Feed status error:', err);
    res.status(500).json({ error: '상태 확인 실패' });
  }
});

export default router;
export { router as charactersRouter };
