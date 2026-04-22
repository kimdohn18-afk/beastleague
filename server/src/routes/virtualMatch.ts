import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { VirtualMatch } from '../models/VirtualMatch';
import { Prediction } from '../models/Prediction';
import { InventoryItem } from '../models/Inventory';
import { ITEM_TEMPLATES } from '../models/Item';
import { simulateMatch, getEquippedBonus, calculateStatGain, calculateMatchXp, rollItemDrop } from '../services/MatchSimulator';
import mongoose from 'mongoose';

export const virtualMatchRouter = Router();

const MATCH_DURATION_MS = 4 * 60 * 60 * 1000;

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
    const remaining = Math.max(0, maxMatches - todayMatches.length);

    const inProgress = todayMatches.find(m => m.status === 'in_progress');
    let activeMatch = null;
    if (inProgress) {
      const now = new Date();
      const completedAt = new Date(inProgress.completedAt);
      activeMatch = {
        matchId: String(inProgress._id),
        startedAt: inProgress.startedAt,
        completedAt: inProgress.completedAt,
        isReady: now >= completedAt,
        remainingMs: Math.max(0, completedAt.getTime() - now.getTime()),
      };
    }

    return res.json({
      today, played: todayMatches.length, maxMatches, remaining,
      hasPrediction: !!hasPrediction, activeMatch,
      hasUnclaimed: !!todayMatches.find(m => m.status === 'in_progress' && new Date() >= new Date(m.completedAt)),
    });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// POST /api/virtual-match/start
virtualMatchRouter.post('/start', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    const existing = await VirtualMatch.findOne({ userId, date: today, status: 'in_progress' });
    if (existing) {
      const completedAt = new Date(existing.completedAt);
      return res.status(400).json({
        error: '이미 경기가 진행 중입니다', code: 'matchInProgress',
        matchId: String(existing._id), completedAt: existing.completedAt,
        remainingMs: Math.max(0, completedAt.getTime() - Date.now()),
      });
    }

    const todayCount = await VirtualMatch.countDocuments({ userId, date: today });
    const hasPrediction = await Prediction.exists({ userId, date: today });
    const maxMatches = hasPrediction ? 2 : 1;
    if (todayCount >= maxMatches) {
      return res.status(400).json({ error: hasPrediction ? '오늘 경기를 모두 사용했습니다 (2/2)' : '오늘 무료 경기를 사용했습니다. 예측하면 추가 1회!', code: 'noRemaining' });
    }

    const stats = character.stats || { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 };
    const { stats: equipBonusStats, xpBonus } = await getEquippedBonus(String(userId));
    const result = simulateMatch(stats, equipBonusStats);
    const statGain = calculateStatGain(result.personal);
    const xpReward = calculateMatchXp(result, xpBonus);
    const drop = rollItemDrop(result);

    let droppedItemId = null;
    if (drop.dropped && drop.templateId) {
      const template = ITEM_TEMPLATES.find(t => t.templateId === drop.templateId);
      if (template) {
        const invItem = await InventoryItem.create({
          userId, characterId: character._id,
          templateId: template.templateId, name: template.name,
          slot: template.slot, rarity: template.rarity, icon: template.icon,
          enhanceLevel: 0,
          currentEffects: template.effects,
          xpBonus: template.xpBonus || 0,
          special: template.special || null,
          setId: template.setId || null,
          currentEffect: template.effects.length > 0 ? { stat: template.effects[0].stat, value: template.effects[0].value, xpBonus: template.xpBonus || 0 } : { stat: '', value: 0, xpBonus: 0 },
          equipped: false,
        });
        droppedItemId = invItem._id;
      }
    }

    const now = new Date();
    const completedAt = new Date(now.getTime() + MATCH_DURATION_MS);

    const match = await VirtualMatch.create({
      userId, characterId: character._id, date: today, matchNumber: todayCount + 1,
      stats, status: 'in_progress', startedAt: now, completedAt,
      result, statGain, xpReward,
      itemDropped: !!droppedItemId, droppedItemId,
    });

    return res.json({ matchId: String(match._id), startedAt: now, completedAt, remainingMs: MATCH_DURATION_MS });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// POST /api/virtual-match/claim/:matchId
virtualMatchRouter.post('/claim/:matchId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const match = await VirtualMatch.findOne({ _id: req.params.matchId, userId });
    if (!match) return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    if (match.status === 'claimed') return res.status(400).json({ error: '이미 보상을 수령했습니다' });
    if (new Date() < new Date(match.completedAt)) {
      return res.status(400).json({ error: '아직 경기가 진행 중입니다', remainingMs: new Date(match.completedAt).getTime() - Date.now() });
    }

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    character.totalXp = (character.totalXp || 0) + match.xpReward;
    character.currentXp = (character.currentXp || 0) + match.xpReward;
    character.xp = character.totalXp;

    const stats = character.stats || { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 };
    stats.power = Math.min(99, stats.power + match.statGain.power);
    stats.skill = Math.min(99, stats.skill + match.statGain.skill);
    stats.agility = Math.min(99, stats.agility + match.statGain.agility);
    stats.stamina = Math.min(99, stats.stamina + match.statGain.stamina);
    stats.mind = Math.min(99, stats.mind + match.statGain.mind);
    character.stats = stats;
    await character.save();

    match.status = 'claimed';
    await match.save();

    let droppedItem = null;
    if (match.itemDropped && match.droppedItemId) {
      const inv = await InventoryItem.findById(match.droppedItemId).lean();
      if (inv) {
        droppedItem = {
          id: String(inv._id), name: inv.name, icon: inv.icon,
          rarity: inv.rarity, slot: inv.slot,
          effects: inv.currentEffects || (inv.currentEffect ? [{ stat: inv.currentEffect.stat, value: inv.currentEffect.value }] : []),
          xpBonus: inv.xpBonus || inv.currentEffect?.xpBonus || 0,
          setId: inv.setId || null,
        };
      }
    }

    return res.json({
      result: match.result, statGain: match.statGain, xpReward: match.xpReward,
      droppedItem, currentXp: character.currentXp, totalXp: character.totalXp, stats: character.stats,
    });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// GET /api/virtual-match/history
virtualMatchRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const matches = await VirtualMatch.find({ userId: req.user!.userId, status: 'claimed' }).sort({ createdAt: -1 }).limit(30).lean();
    return res.json(matches);
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// GET /api/virtual-match/career
virtualMatchRouter.get('/career', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.userId);
    const stats = await VirtualMatch.aggregate([
      { $match: { userId, status: 'claimed' } },
      { $group: {
        _id: null, totalGames: { $sum: 1 }, wins: { $sum: { $cond: ['$result.win', 1, 0] } },
        totalAtBats: { $sum: '$result.personal.atBats' }, totalHits: { $sum: '$result.personal.hits' },
        totalDoubles: { $sum: '$result.personal.doubles' }, totalHomeRuns: { $sum: '$result.personal.homeRuns' },
        totalWalks: { $sum: '$result.personal.walks' }, totalStolenBases: { $sum: '$result.personal.stolenBases' },
        totalRuns: { $sum: '$result.personal.runs' }, totalErrors: { $sum: '$result.personal.errors' },
        mvpCount: { $sum: { $cond: ['$result.personal.mvp', 1, 0] } }, totalXpEarned: { $sum: '$xpReward' },
      }},
    ]);
    if (!stats.length) {
      return res.json({ totalGames: 0, wins: 0, winRate: 0, avg: '.000', totalHits: 0, totalDoubles: 0, totalHomeRuns: 0, totalWalks: 0, totalStolenBases: 0, totalRuns: 0, totalErrors: 0, mvpCount: 0, totalXpEarned: 0 });
    }
    const s = stats[0];
    const avg = s.totalAtBats > 0 ? (s.totalHits / s.totalAtBats).toFixed(3) : '.000';
    return res.json({
      totalGames: s.totalGames, wins: s.wins, winRate: s.totalGames > 0 ? Math.round((s.wins / s.totalGames) * 100) : 0,
      avg: avg.startsWith('0') ? avg.substring(1) : avg,
      totalHits: s.totalHits, totalDoubles: s.totalDoubles, totalHomeRuns: s.totalHomeRuns,
      totalWalks: s.totalWalks, totalStolenBases: s.totalStolenBases, totalRuns: s.totalRuns,
      totalErrors: s.totalErrors, mvpCount: s.mvpCount, totalXpEarned: s.totalXpEarned,
    });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});
