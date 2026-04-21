import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { VirtualMatch } from '../models/VirtualMatch';
import { Prediction } from '../models/Prediction';
import { InventoryItem } from '../models/Inventory';
import { ITEM_TEMPLATES } from '../models/Item';
import { simulateMatch, getEquippedBonus, rollItemDrop, calculateMatchXp } from '../services/MatchSimulator';

export const virtualMatchRouter = Router();

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// GET /api/virtual-match/status — 오늘 남은 횟수 확인
virtualMatchRouter.get('/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();

    const todayMatches = await VirtualMatch.countDocuments({ userId, date: today });
    const hasPrediction = await Prediction.exists({ userId, date: today });

    const maxMatches = hasPrediction ? 2 : 1;
    const remaining = Math.max(0, maxMatches - todayMatches);

    return res.json({
      today,
      played: todayMatches,
      maxMatches,
      remaining,
      hasPrediction: !!hasPrediction,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/virtual-match/play — 경기 뛰기 실행
virtualMatchRouter.post('/play', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const today = todayKST();

    // 캐릭터 확인
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    // 횟수 확인
    const todayMatches = await VirtualMatch.countDocuments({ userId, date: today });
    const hasPrediction = await Prediction.exists({ userId, date: today });
    const maxMatches = hasPrediction ? 2 : 1;

    if (todayMatches >= maxMatches) {
      return res.status(400).json({
        error: hasPrediction
          ? '오늘 경기 뛰기를 모두 사용했습니다 (2/2)'
          : '오늘 경기 뛰기를 사용했습니다. 예측하면 추가 1회!',
        code: 'noRemainingMatches',
        hasPrediction: !!hasPrediction,
      });
    }

    // 장착 아이템 보너스
    const equipBonus = await getEquippedBonus(String(userId));

    // 시뮬레이션
    const stats = character.stats || { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 };
    const result = simulateMatch(stats, equipBonus);

    // 아이템 드롭
    const drop = rollItemDrop(result);
    let droppedItem = null;

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
        droppedItem = {
          id: String(invItem._id),
          name: template.name,
          icon: template.icon,
          rarity: template.rarity,
          slot: template.slot,
          effect: template.baseEffect,
        };
      }
    }

    // XP 보상
    const xpReward = calculateMatchXp(result);
    character.totalXp = (character.totalXp || 0) + xpReward;
    character.currentXp = (character.currentXp || 0) + xpReward;
    character.xp = character.totalXp;
    await character.save();

    // 기록 저장
    const match = await VirtualMatch.create({
      userId,
      characterId: character._id,
      date: today,
      matchNumber: todayMatches + 1,
      stats,
      result,
      itemDropped: !!droppedItem,
      droppedItemId: droppedItem ? droppedItem.id : null,
      xpReward,
    });

    return res.json({
      matchId: String(match._id),
      result,
      xpReward,
      droppedItem,
      remaining: maxMatches - todayMatches - 1,
      currentXp: character.currentXp,
      totalXp: character.totalXp,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/virtual-match/history — 최근 경기 기록
virtualMatchRouter.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const matches = await VirtualMatch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json(matches);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
