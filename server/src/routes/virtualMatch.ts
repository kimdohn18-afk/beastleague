import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { VirtualMatch } from '../models/VirtualMatch';
import { Prediction } from '../models/Prediction';
import { InventoryItem } from '../models/Inventory';
import { ITEM_TEMPLATES } from '../models/Item';
import { simulateMatch, getEquippedBonus, calculateStatGain, calculateMatchXp, rollItemDrop } from '../services/MatchSimulator';

export const virtualMatchRouter = Router();

const MATCH_DURATION_MS = 4 * 60 * 60 * 1000; // 4시간

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// GET /api/virtual-match/status
virtualMatchRouter.get('/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();

    const todayMatches = await VirtualMatch.find({ userId, date: today }).lean();
    const hasPrediction = await Prediction.exists({ userId, date: today });
    const maxMatches = hasPrediction ? 2 : 1;
    const playedCount = todayMatches.length;
    const remaining = Math.max(0, maxMatches - playedCount);

    // 현재 진행 중인 경기
    const inProgress = todayMatches.find(m => m.status === 'in_progress');
    let activeMatch = null;

    if (inProgress) {
      const now = new Date();
      const completedAt = new Date(inProgress.completedAt);
      const isReady = now >= completedAt;

      activeMatch = {
        matchId: String(inProgress._id),
        startedAt: inProgress.startedAt,
        completedAt: inProgress.completedAt,
        isReady,
        remainingMs: isReady ? 0 : completedAt.getTime() - now.getTime(),
      };
    }

    // 결과 미수령 경기
    const unclaimed = todayMatches.find(m => {
      if (m.status === 'in_progress') {
        return new Date() >= new Date(m.completedAt);
      }
      return false;
    });

    return res.json({
      today,
      played: playedCount,
      maxMatches,
      remaining,
      hasPrediction: !!hasPrediction,
      activeMatch,
      hasUnclaimed: !!unclaimed,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/virtual-match/start — 경기 시작 (4시간 타이머)
virtualMatchRouter.post('/start', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    // 진행 중인 경기 확인
    const existing = await VirtualMatch.findOne({ userId, date: today, status: 'in_progress' });
    if (existing) {
      const now = new Date();
      const completedAt = new Date(existing.completedAt);
      return res.status(400).json({
        error: '이미 경기가 진행 중입니다',
        code: 'matchInProgress',
        matchId: String(existing._id),
        completedAt: existing.completedAt,
        remainingMs: Math.max(0, completedAt.getTime() - now.getTime()),
      });
    }

    // 횟수 확인
    const todayCount = await VirtualMatch.countDocuments({ userId, date: today });
    const hasPrediction = await Prediction.exists({ userId, date: today });
    const maxMatches = hasPrediction ? 2 : 1;

    if (todayCount >= maxMatches) {
      return res.status(400).json({
        error: hasPrediction
          ? '오늘 경기를 모두 사용했습니다 (2/2)'
          : '오늘 무료 경기를 사용했습니다. 예측하면 추가 1회!',
        code: 'noRemaining',
      });
    }

    // 시뮬레이션 (결과는 미리 계산해두고 completedAt 이후에 공개)
    const stats = character.stats || { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 };
    const equipBonus = await getEquippedBonus(String(userId));
    const result = simulateMatch(stats, equipBonus);
    const statGain = calculateStatGain(result.personal);
    const xpReward = calculateMatchXp(result);
    const drop = rollItemDrop(result);

    let droppedItemId = null;
    if (drop.dropped && drop.templateId) {
      const template = ITEM_TEMPLATES.find(t => t.templateId === drop.templateId);
      if (template) {
        const invItem = await InventoryItem.create({
          userId,
          characterId: character._id,
          templateId: template.templateId,
          name: template.name,
          slot: template.slot,
          rarity: template.rarity,
          icon: template.icon,
          enhanceLevel: 0,
          currentEffect: template.baseEffect,
          equipped: false,
        });
        droppedItemId = invItem._id;
      }
    }

    const now = new Date();
    const completedAt = new Date(now.getTime() + MATCH_DURATION_MS);

    const match = await VirtualMatch.create({
      userId,
      characterId: character._id,
      date: today,
      matchNumber: todayCount + 1,
      stats,
      status: 'in_progress',
      startedAt: now,
      completedAt,
      result,
      statGain,
      xpReward,
      itemDropped: !!droppedItemId,
      droppedItemId,
    });

    return res.json({
      matchId: String(match._id),
      startedAt: now,
      completedAt,
      remainingMs: MATCH_DURATION_MS,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/virtual-match/claim/:matchId — 결과 수령
virtualMatchRouter.post('/claim/:matchId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const match = await VirtualMatch.findOne({ _id: req.params.matchId, userId });

    if (!match) return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    if (match.status === 'claimed') return res.status(400).json({ error: '이미 보상을 수령했습니다' });

    const now = new Date();
    if (now < new Date(match.completedAt)) {
      return res.status(400).json({
        error: '아직 경기가 진행 중입니다',
        remainingMs: new Date(match.completedAt).getTime() - now.getTime(),
      });
    }

    // 보상 지급
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    // XP 지급
    character.totalXp = (character.totalXp || 0) + match.xpReward;
    character.currentXp = (character.currentXp || 0) + match.xpReward;
    character.xp = character.totalXp;

    // 스탯 상승
    const stats = character.stats || { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 };
    stats.power = Math.min(99, stats.power + match.statGain.power);
    stats.skill = Math.min(99, stats.skill + match.statGain.skill);
    stats.agility = Math.min(99, stats.agility + match.statGain.agility);
    stats.stamina = Math.min(99, stats.stamina + match.statGain.stamina);
    stats.mind = Math.min(99, stats.mind + match.statGain.mind);
    character.stats = stats;

    await character.save();

    // 경기 상태 업데이트
    match.status = 'claimed';
    await match.save();

    // 드롭 아이템 정보
    let droppedItem = null;
    if (match.itemDropped && match.droppedItemId) {
      const inv = await InventoryItem.findById(match.droppedItemId).lean();
      if (inv) {
        droppedItem = {
          id: String(inv._id),
          name: inv.name,
          icon: inv.icon,
          rarity: inv.rarity,
          slot: inv.slot,
          effect: inv.currentEffect,
        };
      }
    }

    return res.json({
      result: match.result,
      statGain: match.statGain,
      xpReward: match.xpReward,
      droppedItem,
      currentXp: character.currentXp,
      totalXp: character.totalXp,
      stats: character.stats,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/virtual-match/history
virtualMatchRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const matches = await VirtualMatch.find({ userId, status: 'claimed' })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return res.json(matches);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/virtual-match/career — 통산 기록
virtualMatchRouter.get('/career', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await VirtualMatch.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(String(userId)), status: 'claimed' } },
      { $group: {
        _id: null,
        totalGames: { $sum: 1 },
        wins: { $sum: { $cond: ['$result.win', 1, 0] } },
        totalAtBats: { $sum: '$result.personal.atBats' },
        totalHits: { $sum: '$result.personal.hits' },
        totalDoubles: { $sum: '$result.personal.doubles' },
        totalHomeRuns: { $sum: '$result.personal.homeRuns' },
        totalWalks: { $sum: '$result.personal.walks' },
        totalStolenBases: { $sum: '$result.personal.stolenBases' },
        totalRuns: { $sum: '$result.personal.runs' },
        totalErrors: { $sum: '$result.personal.errors' },
        mvpCount: { $sum: { $cond: ['$result.personal.mvp', 1, 0] } },
        totalXpEarned: { $sum: '$xpReward' },
      }},
    ]);

    if (!stats.length) {
      return res.json({
        totalGames: 0, wins: 0, winRate: 0,
        avg: '.000', totalHits: 0, totalDoubles: 0,
        totalHomeRuns: 0, totalWalks: 0, totalStolenBases: 0,
        totalRuns: 0, totalErrors: 0, mvpCount: 0, totalXpEarned: 0,
      });
    }

    const s = stats[0];
    const avg = s.totalAtBats > 0 ? (s.totalHits / s.totalAtBats).toFixed(3) : '.000';
    const winRate = s.totalGames > 0 ? Math.round((s.wins / s.totalGames) * 100) : 0;

    return res.json({
      totalGames: s.totalGames,
      wins: s.wins,
      winRate,
      avg: avg.startsWith('0') ? avg.substring(1) : avg,
      totalHits: s.totalHits,
      totalDoubles: s.totalDoubles,
      totalHomeRuns: s.totalHomeRuns,
      totalWalks: s.totalWalks,
      totalStolenBases: s.totalStolenBases,
      totalRuns: s.totalRuns,
      totalErrors: s.totalErrors,
      mvpCount: s.mvpCount,
      totalXpEarned: s.totalXpEarned,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
