import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { InventoryItem } from '../models/Inventory';
import { ItemSlot } from '../models/Item';

export const inventoryRouter = Router();

const VALID_SLOTS: ItemSlot[] = ['bat', 'glove', 'shoes', 'helmet', 'accessory'];

const SLOT_NAMES: Record<string, string> = {
  bat: '배트', glove: '글러브', shoes: '신발', helmet: '헬멧', accessory: '악세서리',
};

// 강화 비용 및 성공 확률
function getEnhanceCost(level: number): number {
  return 20 + level * 15; // 0→1: 20XP, 1→2: 35XP, ...
}

function getEnhanceSuccessRate(level: number): number {
  // 0→1: 95%, 1→2: 90%, ... 9→10: 50%
  return Math.max(0.5, 0.95 - level * 0.05);
}

function getEnhancedValue(baseValue: number, level: number): number {
  // 강화 1단계당 기본값의 20% 추가
  return Math.round(baseValue * (1 + level * 0.2));
}

// GET /api/inventory — 내 아이템 목록
inventoryRouter.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const items = await InventoryItem.find({ userId }).sort({ equipped: -1, rarity: -1, createdAt: -1 }).lean();

    const equipped = items.filter(i => i.equipped);
    const unequipped = items.filter(i => !i.equipped);

    return res.json({ equipped, unequipped, totalItems: items.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/inventory/:itemId/equip — 아이템 장착
inventoryRouter.post('/:itemId/equip', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId });

    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
    if (item.equipped) return res.status(400).json({ error: '이미 장착 중입니다' });

    // 같은 슬롯에 장착 중인 아이템 해제
    await InventoryItem.updateMany(
      { userId, slot: item.slot, equipped: true },
      { $set: { equipped: false } }
    );

    item.equipped = true;
    await item.save();

    return res.json({ success: true, item });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/inventory/:itemId/unequip — 아이템 해제
inventoryRouter.post('/:itemId/unequip', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId });

    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
    if (!item.equipped) return res.status(400).json({ error: '장착되지 않은 아이템입니다' });

    item.equipped = false;
    await item.save();

    return res.json({ success: true, item });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/inventory/:itemId/enhance — 아이템 강화
inventoryRouter.post('/:itemId/enhance', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId });

    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
    if (item.enhanceLevel >= 10) return res.status(400).json({ error: '최대 강화 단계입니다 (+10)' });

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    const cost = getEnhanceCost(item.enhanceLevel);
    if ((character.currentXp || 0) < cost) {
      return res.status(400).json({
        error: `보유 XP가 부족합니다 (${cost} XP 필요, 보유 ${character.currentXp || 0} XP)`,
        code: 'insufficientXp',
      });
    }

    const successRate = getEnhanceSuccessRate(item.enhanceLevel);
    const success = Math.random() < successRate;

    // XP 차감 (성공이든 실패든)
    character.currentXp = (character.currentXp || 0) - cost;
    character.xp = character.totalXp || 0;
    await character.save();

    if (success) {
      item.enhanceLevel += 1;
      // 효과 수치 갱신
      const baseValue = item.currentEffect?.value || 1;
      const originalBase = Math.round(baseValue / (1 + (item.enhanceLevel - 1) * 0.2));
      item.currentEffect = {
        ...item.currentEffect,
        value: getEnhancedValue(originalBase, item.enhanceLevel),
      };
      await item.save();

      return res.json({
        success: true,
        enhanced: true,
        item,
        cost,
        newLevel: item.enhanceLevel,
        currentXp: character.currentXp,
        message: `강화 성공! +${item.enhanceLevel}`,
      });
    } else {
      // 실패: 아이템 유지, XP만 소모
      return res.json({
        success: true,
        enhanced: false,
        item,
        cost,
        currentXp: character.currentXp,
        message: '강화 실패... 아이템은 유지됩니다.',
      });
    }
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/inventory/:itemId/enhance-info — 강화 정보 미리보기
inventoryRouter.get('/:itemId/enhance-info', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId }).lean();

    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });

    const cost = getEnhanceCost(item.enhanceLevel);
    const successRate = getEnhanceSuccessRate(item.enhanceLevel);
    const maxLevel = item.enhanceLevel >= 10;

    return res.json({
      currentLevel: item.enhanceLevel,
      cost,
      successRate: Math.round(successRate * 100),
      maxLevel,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/inventory/:itemId — 아이템 분해 (XP 회수)
inventoryRouter.delete('/:itemId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId });

    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });

    const rarityXp: Record<string, number> = { common: 5, rare: 15, epic: 40, legendary: 100 };
    const refund = (rarityXp[item.rarity] || 5) + item.enhanceLevel * 5;

    const character = await Character.findOne({ userId });
    if (character) {
      character.totalXp = (character.totalXp || 0) + refund;
      character.currentXp = (character.currentXp || 0) + refund;
      character.xp = character.totalXp;
      await character.save();
    }

    await InventoryItem.findByIdAndDelete(item._id);

    return res.json({
      success: true,
      refund,
      currentXp: character?.currentXp || 0,
      message: `${item.name}을(를) 분해하여 ${refund} XP를 획득했습니다.`,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
