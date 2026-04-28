import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
import { Game } from '../models/Game';
import { Like } from '../models/Like';
import { Feed } from '../models/Feed';
import { GuestBook } from '../models/GuestBook';
import {
  calculateAchievements,
  getAllAchievements,
  getAchievementById,
} from '../services/TraitCalculator';

const router = Router();

const VALID_ANIMALS = [
  'turtle', 'eagle', 'lion', 'dinosaur', 'dog',
  'fox', 'penguin', 'shark', 'bear', 'tiger',
  'seagull', 'dragon', 'cat', 'rabbit', 'gorilla', 'elephant',
];

// ━━━ 팀 & 티어 상수 ━━━
const ALL_TEAMS: Record<string, { name: string; emoji: string }> = {
  samsung: { name: '삼성 라이온즈', emoji: '🦁' },
  kia:     { name: '기아 타이거즈', emoji: '🐯' },
  lg:      { name: 'LG 트윈스',    emoji: '🤞' },
  doosan:  { name: '두산 베어스',   emoji: '🐻' },
  kt:      { name: 'KT 위즈',      emoji: '🧙' },
  ssg:     { name: 'SSG 랜더스',    emoji: '🛬' },
  lotte:   { name: '롯데 자이언츠', emoji: '🦅' },
  hanwha:  { name: '한화 이글스',   emoji: '🦅' },
  nc:      { name: 'NC 다이노스',   emoji: '🦕' },
  kiwoom:  { name: '키움 히어로즈', emoji: '🦸' },
};

const TEAM_TIERS = [
  { tier: 'diamond', minCount: 30, emoji: '💎', label: '다이아' },
  { tier: 'gold',    minCount: 15, emoji: '🥇', label: '금' },
  { tier: 'silver',  minCount: 5,  emoji: '🥈', label: '은' },
  { tier: 'bronze',  minCount: 1,  emoji: '🥉', label: '동' },
];

// ━━━ 팀 충성도 계산 헬퍼 ━━━
async function getTeamAchievements(userId: string) {
  const teamCounts = await Placement.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: '$team', count: { $sum: 1 } } },
  ]);

  const results = [];
  for (const tc of teamCounts) {
    const teamId = tc._id;
    const count = tc.count;
    const teamInfo = ALL_TEAMS[teamId];
    if (!teamInfo) continue;

    let achievedTier = null;
    for (const t of TEAM_TIERS) {
      if (count >= t.minCount) {
        achievedTier = t;
        break;
      }
    }

    if (achievedTier) {
      results.push({
        teamId,
        teamName: teamInfo.name,
        teamEmoji: teamInfo.emoji,
        tier: achievedTier,
        count,
      });
    }
  }
  return results;
}

function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function getCharacterSize(xp: number): number {
  const minPx = 60;
  if (xp <= 0) return minPx;
  const size = minPx + Math.pow(xp, 0.55) * 7.5;
  return Math.max(minPx, Math.round(size));
}

function getEvolutionStage(xp: number) {
  const stages = [
    { stage: 1, minXp: 0 },
    { stage: 2, minXp: 300 },
    { stage: 3, minXp: 1000 },
    { stage: 4, minXp: 3000 },
    { stage: 5, minXp: 10000 },
  ];
  let current = stages[0];
  for (const s of stages) {
    if (xp >= s.minXp) current = s;
  }
  return current;
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
    await GuestBook.deleteMany({
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

/* ───── GET /me/guestbook — 내 캐릭터에 달린 방명록 ───── */
router.get('/me/guestbook', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const entries = await GuestBook.find({ toCharacterId: character._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 작성자 정보 붙이기
    const writerIds = [...new Set(entries.map((e: any) => e.fromUserId.toString()))];
    const writers = await Character.find(
      { userId: { $in: writerIds } },
      { userId: 1, name: 1, animalType: 1 }
    ).lean();

    const writerMap: Record<string, { name: string; animalType: string }> = {};
    for (const w of writers) {
      writerMap[w.userId.toString()] = { name: w.name, animalType: w.animalType };
    }

    const result = entries.map((e: any) => {
      const writer = writerMap[e.fromUserId.toString()];
      return {
        _id: e._id,
        message: e.message,
        createdAt: e.createdAt,
        fromUserId: e.fromUserId,
        writerName: writer?.name || '알 수 없음',
        writerAnimal: writer?.animalType || 'bear',
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Guestbook fetch error:', err);
    res.status(500).json({ error: '방명록 조회 실패' });
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

/* ───── GET /me/achievements — 내 업적 (팀 충성도 포함) ───── */
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

    const allAchievements = getAllAchievements();
    const earnedSet = new Set(result.earned);

    const achievements = allAchievements.map(a => ({
      ...a,
      earned: earnedSet.has(a.id),
    }));

    const teamAchievements = await getTeamAchievements(userId);

    let activeTrait = result.activeTrait;
    if (!activeTrait && character.activeTrait) {
      const teamInfo = ALL_TEAMS[character.activeTrait];
      const teamAch = teamAchievements.find(ta => ta.teamId === character.activeTrait);
      if (teamInfo && teamAch) {
        activeTrait = {
          id: character.activeTrait,
          emoji: teamInfo.emoji,
          name: `${teamInfo.name} ${teamAch.tier.label}`,
          description: `${teamInfo.name} ${teamAch.count}회 배치 달성`,
        };
      }
    }

    res.json({
      activeTrait,
      earnedCount: result.earnedCount,
      totalCount: allAchievements.length,
      achievements,
      teamAchievements,
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

    let earnedTeam = false;
    if (!earnedGeneral && ALL_TEAMS[traitId]) {
      const teamAchievements = await getTeamAchievements(userId);
      earnedTeam = teamAchievements.some(ta => ta.teamId === traitId);
    }

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

/* ───── GET /me/unclaimed-xp — 미수확 XP ───── */
router.get('/me/unclaimed-xp', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    kst.setDate(kst.getDate() - 1);
    const yesterday = kst.toISOString().split('T')[0];

    const placement = await Placement.findOne({
      userId,
      date: yesterday,
      status: 'settled',
    }).lean();

    if (!placement) {
      return res.json({ hasUnclaimed: false, orbs: [], totalXp: 0, date: yesterday });
    }

    const totalXp = (placement.xpFromPlayer || 0) + (placement.xpFromPrediction || 0);
    const breakdown = placement.xpBreakdown;

    const orbs: Array<{ label: string; emoji: string; xp: number }> = [];

    if (breakdown) {
      if (breakdown.hits > 0)            orbs.push({ label: '안타', emoji: '⚾', xp: breakdown.hits });
      if (breakdown.double > 0)          orbs.push({ label: '2루타', emoji: '💫', xp: breakdown.double });
      if (breakdown.triple > 0)          orbs.push({ label: '3루타', emoji: '🌟', xp: breakdown.triple });
      if (breakdown.homeRun > 0)         orbs.push({ label: '홈런', emoji: '💥', xp: breakdown.homeRun });
      if (breakdown.rbi > 0)            orbs.push({ label: '타점', emoji: '🎯', xp: breakdown.rbi });
      if (breakdown.runs > 0)           orbs.push({ label: '득점', emoji: '🏃', xp: breakdown.runs });
      if (breakdown.stolenBase > 0)      orbs.push({ label: '도루', emoji: '💨', xp: breakdown.stolenBase });
      if (breakdown.walkOff > 0)         orbs.push({ label: '끝내기', emoji: '🎬', xp: breakdown.walkOff });
      if (breakdown.teamResult > 0)      orbs.push({ label: '팀 승리', emoji: '🏆', xp: breakdown.teamResult });
      if (breakdown.noHitPenalty < 0)    orbs.push({ label: '무안타', emoji: '😢', xp: breakdown.noHitPenalty });
      if (breakdown.caughtStealing < 0)  orbs.push({ label: '도루실패', emoji: '⚠️', xp: breakdown.caughtStealing });
    }

    const predXp = placement.xpFromPrediction || 0;
    if (predXp > 0) orbs.push({ label: '예측 적중', emoji: '🔮', xp: predXp });
    if (predXp < 0) orbs.push({ label: '예측 실패', emoji: '❌', xp: predXp });

    if (orbs.length === 0 && totalXp !== 0) {
      orbs.push({ label: 'XP', emoji: '✨', xp: totalXp });
    }

    res.json({
      hasUnclaimed: true,
      orbs,
      totalXp,
      date: yesterday,
      gameId: placement.gameId,
    });
  } catch (err) {
    console.error('Unclaimed XP error:', err);
    res.status(500).json({ error: '미수확 XP 조회 실패' });
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

    const totalXp = character.totalXp ?? character.xp ?? 0;

    const STAGES = [
      { stage: 1, name: '아기',  minXp: 0,     badge: '🥚' },
      { stage: 2, name: '성장',  minXp: 300,   badge: '⭐' },
      { stage: 3, name: '성숙',  minXp: 1000,  badge: '🔥' },
      { stage: 4, name: '전설',  minXp: 3000,  badge: '👑' },
      { stage: 5, name: '신화',  minXp: 10000, badge: '💎' },
    ];

    let current = STAGES[0];
    for (const s of STAGES) {
      if (totalXp >= s.minXp) current = s;
    }
    const next = STAGES.find(s => totalXp < s.minXp) || null;

    res.json({
      totalXp,
      xp: character.xp,
      currentStage: current,
      nextStage: next,
      xpToNext: next ? next.minXp - totalXp : 0,
    });
  } catch (err) {
    console.error('Evolution info error:', err);
    res.status(500).json({ error: '진화 정보 조회 실패' });
  }
});

/* ───── POST /me/evolve — 진화 ───── */
router.post('/me/evolve', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const currentStage = character.evolvedStage || 1;
    if (currentStage >= 5) {
      return res.status(400).json({ error: '이미 최고 단계입니다' });
    }

    // 누적 XP 기준 진화 조건 (소모 없음)
    const EVOLVE_REQUIREMENTS = [
      null,
      null,
      { totalXpRequired: 300,   requiredAchievements: 3 },
      { totalXpRequired: 1000,  requiredAchievements: 8 },
      { totalXpRequired: 3000,  requiredAchievements: 15 },
      { totalXpRequired: 10000, requiredAchievements: 25 },
    ];

    const nextStage = currentStage + 1;
    const req_data = EVOLVE_REQUIREMENTS[nextStage];
    if (!req_data) {
      return res.status(400).json({ error: '진화 조건을 찾을 수 없습니다' });
    }

    const totalXp = character.totalXp ?? character.xp ?? 0;
    const earnedCount = (character.earnedAchievements || []).length
      + (character.teamAchievements || []).length;

    if (totalXp < req_data.totalXpRequired) {
      return res.status(400).json({
        error: `누적 XP가 부족합니다 (${req_data.totalXpRequired} XP 필요, 현재 ${totalXp} XP)`,
        code: 'insufficientXp',
      });
    }

    if (earnedCount < req_data.requiredAchievements) {
      return res.status(400).json({
        error: `업적이 부족합니다 (${req_data.requiredAchievements}개 필요, 현재 ${earnedCount}개)`,
        code: 'insufficientAchievements',
      });
    }

    // XP 차감 없음 — 누적 도달만 확인
    character.evolvedStage = nextStage;
    character.displayStage = null;
    await character.save();

    const STAGE_NAMES = ['', '아기', '성장', '성숙', '전설', '신화'];
    const STAGE_BADGES = ['', '🥚', '⭐', '🔥', '👑', '💎'];

    res.json({
      success: true,
      evolvedStage: nextStage,
      stageName: STAGE_NAMES[nextStage],
      badge: STAGE_BADGES[nextStage],
      totalXp,
      xp: character.xp,
    });
  } catch (err) {
    console.error('Evolve error:', err);
    res.status(500).json({ error: '진화 실패' });
  }
});

/* ───── PUT /me/display — 표시 단계 & 크기 변경 ───── */
router.put('/me/display', authenticateUser, async (req: Request, res: Response) => {
  try {
    const character = await Character.findOne({ userId: req.user!.userId });
    if (!character) return res.status(404).json({ error: '캐릭터 없음' });

    const { displayStage, displaySize } = req.body;

    if (displayStage !== null && displayStage !== undefined) {
      const maxStage = character.evolvedStage || 1;
      if (displayStage < 1 || displayStage > maxStage) {
        return res.status(400).json({ error: '해금되지 않은 단계입니다' });
      }
      character.displayStage = displayStage;
    } else if (displayStage === null) {
      character.displayStage = null;
    }

    if (displaySize !== null && displaySize !== undefined) {
      const maxSize = getCharacterSize(character.xp);
      if (displaySize < 60 || displaySize > maxSize) {
        return res.status(400).json({ error: '현재 크기보다 클 수 없습니다' });
      }
      character.displaySize = displaySize;
    } else if (displaySize === null) {
      character.displaySize = null;
    }

    await character.save();
    res.json({
      displayStage: character.displayStage,
      displaySize: character.displaySize,
    });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ───── PUT /me/animal — 캐릭터 동물 변경 ───── */
router.put('/me/animal', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { animalType } = req.body;

    if (!animalType || !VALID_ANIMALS.includes(animalType)) {
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

/* ───── GET /:id/public — 공개 프로필 ───── */
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

    const todayPlacement = await Placement.findOne({
      userId: character.userId,
      date: today,
    }).lean();

    let placementInfo = null;
    if (todayPlacement) {
      const placementGame = await Game.findOne({ gameId: todayPlacement.gameId })
        .select('gameId homeTeam awayTeam status homeScore awayScore startTime batterRecords')
        .lean();

      let playerName = null;
      if (placementGame && (placementGame as any).batterRecords) {
        const isHome = todayPlacement.team === placementGame.homeTeam;
        const records = isHome
          ? (placementGame as any).batterRecords.home
          : (placementGame as any).batterRecords.away;
        if (Array.isArray(records)) {
          const player = records.find((r: any) => r.order === todayPlacement.battingOrder);
          if (player) playerName = player.name;
        }
      }

      placementInfo = {
        gameId: todayPlacement.gameId,
        team: todayPlacement.team,
        battingOrder: todayPlacement.battingOrder,
        predictedWinner: todayPlacement.predictedWinner,
        playerName,
        status: todayPlacement.status,
        xpFromPlayer: todayPlacement.xpFromPlayer ?? null,
        xpFromPrediction: todayPlacement.xpFromPrediction ?? null,
        xpBreakdown: todayPlacement.xpBreakdown ?? null,
        game: placementGame ? {
          homeTeam: placementGame.homeTeam,
          awayTeam: placementGame.awayTeam,
          status: placementGame.status,
          homeScore: placementGame.homeScore,
          awayScore: placementGame.awayScore,
          startTime: placementGame.startTime,
        } : null,
      };
    }

    const guestBookEntries = await GuestBook.find({
      toCharacterId: id,
      date: today,
    }).sort({ createdAt: -1 }).lean();

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
      todayPlacement: placementInfo,
      guestBook: guestBookEntries.map(g => ({
        id: String(g._id),
        fromCharacterName: g.fromCharacterName,
        fromAnimalType: g.fromAnimalType,
        message: g.message,
        createdAt: g.createdAt,
      })),
    });
  } catch (err) {
    console.error('Public profile error:', err);
    res.status(500).json({ error: '프로필 조회 실패' });
  }
});

/* ───── POST /:id/guestbook — 방명록 작성 ───── */
router.post('/:id/guestbook', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetId = req.params.id;
    const { message } = req.body;
    const today = todayKST();

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: '잘못된 ID입니다' });
    }
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: '메시지를 입력해주세요' });
    }
    if (message.length > 100) {
      return res.status(400).json({ error: '메시지는 100자 이내로 입력해주세요' });
    }

    const targetChar = await Character.findById(targetId);
    if (!targetChar) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    }

    const myChar = await Character.findOne({ userId });
    if (!myChar) {
      return res.status(400).json({ error: '캐릭터가 없습니다' });
    }

    const existing = await GuestBook.findOne({ toCharacterId: targetId, fromUserId: userId, date: today });
    if (existing) {
      return res.status(400).json({ error: '오늘 이미 방명록을 남겼어요', code: 'alreadyWritten' });
    }

    const entry = await GuestBook.create({
      toCharacterId: targetId,
      fromUserId: userId,
      fromCharacterName: myChar.name,
      fromAnimalType: myChar.animalType,
      message: message.trim(),
      date: today,
    });

    res.status(201).json({
      id: String(entry._id),
      fromCharacterName: entry.fromCharacterName,
      fromAnimalType: entry.fromAnimalType,
      message: entry.message,
      createdAt: entry.createdAt,
    });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(400).json({ error: '오늘 이미 방명록을 남겼어요', code: 'alreadyWritten' });
    }
    console.error('GuestBook write error:', err);
    res.status(500).json({ error: '방명록 작성 실패' });
  }
});

/* ───── DELETE /:id/guestbook/:entryId ───── */
router.delete('/:id/guestbook/:entryId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id: targetId, entryId } = req.params;

    const character = await Character.findById(targetId);
    if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    if (String(character.userId) !== userId) return res.status(403).json({ error: '프로필 주인만 삭제할 수 있습니다' });

    const entry = await GuestBook.findOneAndDelete({ _id: entryId, toCharacterId: targetId });
    if (!entry) return res.status(404).json({ error: '방명록을 찾을 수 없습니다' });

    res.json({ deleted: true });
  } catch (err) {
    console.error('GuestBook delete error:', err);
    res.status(500).json({ error: '방명록 삭제 실패' });
  }
});

/* ───── POST /:id/like ───── */
router.post('/:id/like', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetId = req.params.id;
    const today = todayKST();

    if (!mongoose.Types.ObjectId.isValid(targetId)) return res.status(400).json({ error: '잘못된 ID입니다' });

    const targetChar = await Character.findById(targetId);
    if (!targetChar) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    if (String(targetChar.userId) === userId) return res.status(400).json({ error: '자신에게는 좋아요를 할 수 없습니다' });

    const alreadyLiked = await Like.findOne({ fromUserId: userId, toCharacterId: targetId, date: today });
    if (alreadyLiked) return res.status(400).json({ error: '오늘 이미 좋아요를 눌렀어요', code: 'alreadyLiked' });

    await Like.create({ fromUserId: userId, toCharacterId: targetId, date: today });
    await Character.findByIdAndUpdate(targetId, { $inc: { totalLikes: 1 } });

    const updated = await Character.findById(targetId);
    res.json({ liked: true, totalLikes: updated?.totalLikes || 0 });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: '좋아요 실패' });
  }
});

/* ───── GET /:id/like-status ───── */
router.get('/:id/like-status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();
    const liked = await Like.findOne({ fromUserId: userId, toCharacterId: req.params.id, date: today });
    res.json({ liked: !!liked });
  } catch (err) {
    console.error('Like status error:', err);
    res.status(500).json({ error: '상태 확인 실패' });
  }
});

/* ───── POST /:id/feed ───── */
router.post('/:id/feed', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetId = req.params.id;
    const today = todayKST();

    if (!mongoose.Types.ObjectId.isValid(targetId)) return res.status(400).json({ error: '잘못된 ID입니다' });

    const myChar = await Character.findOne({ userId });
    if (!myChar) return res.status(404).json({ error: '내 캐릭터가 없습니다' });

    const targetChar = await Character.findById(targetId);
    if (!targetChar) return res.status(404).json({ error: '대상 캐릭터를 찾을 수 없습니다' });

    const isSelf = String(myChar._id) === String(targetChar._id);
    const xpCost = isSelf ? 0 : 5;
    const xpGiven = 3;

    if (!isSelf && myChar.xp < xpCost) return res.status(400).json({ error: 'XP가 부족합니다 (5 XP 필요)' });

    const alreadyFed = await Feed.findOne({ fromUserId: userId, toCharacterId: targetChar._id, date: today });
    if (alreadyFed) return res.status(400).json({ error: '오늘 이미 밥을 줬어요', code: 'alreadyFed' });

    let remainingFeeds = 3;
    if (!isSelf) {
      const todayFeedCount = await Feed.countDocuments({ fromUserId: userId, date: today, isSelf: false });
      if (todayFeedCount >= 3) return res.status(400).json({ error: '오늘 밥주기 횟수를 모두 사용했어요 (3회)', code: 'limitReached' });
      remainingFeeds = 3 - todayFeedCount - 1;
    }

    await Feed.create({ fromUserId: userId, toCharacterId: targetChar._id, date: today, xpCost, xpGiven, isSelf });

    if (!isSelf) await Character.findByIdAndUpdate(myChar._id, { $inc: { xp: -xpCost } });
    await Character.findByIdAndUpdate(targetChar._id, { $inc: { xp: xpGiven, totalFeeds: 1 } });

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

/* ───── GET /:id/feed-status ───── */
router.get('/:id/feed-status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();

    const fed = await Feed.findOne({ fromUserId: userId, toCharacterId: req.params.id, date: today });
    const todayFeedCount = await Feed.countDocuments({ fromUserId: userId, date: today, isSelf: false });

    res.json({ fed: !!fed, remainingFeeds: Math.max(0, 3 - todayFeedCount) });
  } catch (err) {
    console.error('Feed status error:', err);
    res.status(500).json({ error: '상태 확인 실패' });
  }
});

export default router;
export { router as charactersRouter };
