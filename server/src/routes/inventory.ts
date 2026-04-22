import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';
import { InventoryItem } from '../models/Inventory';
import { ItemSlot, SET_BONUSES, ITEM_TEMPLATES } from '../models/Item';

export const inventoryRouter = Router();

function getEnhanceCost(level: number): number { return 20 + level * 15; }
function getEnhanceSuccessRate(level: number): number { return Math.max(0.5, 0.95 - level * 0.05); }
function getEnhancedValue(baseValue: number, level: number): number { return Math.round(baseValue * (1 + level * 0.2)); }

const SHOP_PRICES: Record<string, number> = {
  common: 30,
  rare: 100,
  epic: 300,
  legendary: 800,
};

// GET /api/inventory
inventoryRouter.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const items = await InventoryItem.find({ userId }).sort({ equipped: -1, rarity: -1, createdAt: -1 }).lean();
    const equipped = items.filter(i => i.equipped);
    const unequipped = items.filter(i => !i.equipped);

    const setCounts: Record<string, number> = {};
    for (const item of equipped) {
      if (item.setId) setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
    }
    const activeSets: { setId: string; name: string; count: number; activeBonus: string | null; nextBonus: { count: number; description: string } | null }[] = [];
    for (const setDef of SET_BONUSES) {
      const count = setCounts[setDef.setId] || 0;
      if (count > 0) {
        let activeBonus: string | null = null;
        let nextBonus: { count: number; description: string } | null = null;
        for (const tier of setDef.bonuses) {
          if (count >= tier.count) activeBonus = tier.description;
          else if (!nextBonus) nextBonus = { count: tier.count, description: tier.description };
        }
        activeSets.push({ setId: setDef.setId, name: setDef.name, count, activeBonus, nextBonus });
      }
    }

    return res.json({ equipped, unequipped, totalItems: items.length, activeSets });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// GET /api/inventory/catalog — 아이템 도감
inventoryRouter.get('/catalog', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ownedItems = await InventoryItem.find({ userId }).select('templateId').lean();
    const ownedSet = new Set(ownedItems.map(i => i.templateId));

    const catalog = ITEM_TEMPLATES.map(t => ({
      templateId: t.templateId,
      name: t.name,
      description: t.description,
      slot: t.slot,
      rarity: t.rarity,
      icon: t.icon,
      effects: t.effects,
      xpBonus: t.xpBonus || 0,
      special: t.special || null,
      setId: t.setId || null,
      owned: ownedSet.has(t.templateId),
      price: SHOP_PRICES[t.rarity] || 30,
    }));

    const sets = SET_BONUSES.map(s => ({
      setId: s.setId,
      name: s.name,
      bonuses: s.bonuses.map(b => ({ count: b.count, description: b.description })),
      items: ITEM_TEMPLATES.filter(t => t.setId === s.setId).map(t => ({
        templateId: t.templateId, name: t.name, icon: t.icon,
        slot: t.slot, rarity: t.rarity, owned: ownedSet.has(t.templateId),
      })),
    }));

    const totalCount = ITEM_TEMPLATES.length;
    const ownedCount = ownedSet.size;
    const completion = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

    const character = await Character.findOne({ userId }).select('currentXp totalXp').lean();

    return res.json({ catalog, sets, totalCount, ownedCount, completion, currentXp: character?.currentXp || 0 });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// POST /api/inventory/buy — 아이템 구매
inventoryRouter.post('/buy', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { templateId } = req.body;

    if (!templateId) return res.status(400).json({ error: 'templateId가 필요합니다' });

    const template = ITEM_TEMPLATES.find(t => t.templateId === templateId);
    if (!template) return res.status(404).json({ error: '존재하지 않는 아이템입니다' });

    const price = SHOP_PRICES[template.rarity] || 30;

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ error: '캐릭터가 없습니다' });

    if ((character.currentXp || 0) < price) {
      return res.status(400).json({
        error: `XP가 부족합니다 (${price} XP 필요, 보유 ${character.currentXp || 0} XP)`,
        code: 'insufficientXp',
        price,
        currentXp: character.currentXp || 0,
      });
    }

    // XP 차감
    character.currentXp = (character.currentXp || 0) - price;
    character.xp = character.totalXp || 0;
    await character.save();

    // 아이템 생성
    const invItem = await InventoryItem.create({
      userId,
      characterId: character._id,
      templateId: template.templateId,
      name: template.name,
      slot: template.slot,
      rarity: template.rarity,
      icon: template.icon,
      enhanceLevel: 0,
      currentEffects: template.effects,
      xpBonus: template.xpBonus || 0,
      special: template.special || null,
      setId: template.setId || null,
      currentEffect: template.effects.length > 0
        ? { stat: template.effects[0].stat, value: template.effects[0].value, xpBonus: template.xpBonus || 0 }
        : { stat: '', value: 0, xpBonus: 0 },
      equipped: false,
    });

    return res.json({
      success: true,
      item: invItem,
      price,
      currentXp: character.currentXp,
      message: `${template.name}을(를) 구매했습니다! (-${price} XP)`,
    });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// POST /api/inventory/:itemId/equip
inventoryRouter.post('/:itemId/equip', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId });
    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
    if (item.equipped) return res.status(400).json({ error: '이미 장착 중입니다' });
    await InventoryItem.updateMany({ userId, slot: item.slot, equipped: true }, { $set: { equipped: false } });
    item.equipped = true;
    await item.save();
    return res.json({ success: true, item });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// POST /api/inventory/:itemId/unequip
inventoryRouter.post('/:itemId/unequip', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId });
    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
    if (!item.equipped) return res.status(400).json({ error: '장착되지 않은 아이템입니다' });
    item.equipped = false;
    await item.save();
    return res.json({ success: true, item });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// POST /api/inventory/:itemId/enhance
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
      return res.status(400).json({ error: `보유 XP가 부족합니다 (${cost} XP 필요)`, code: 'insufficientXp' });
    }

    const successRate = getEnhanceSuccessRate(item.enhanceLevel);
    const success = Math.random() < successRate;

    character.currentXp = (character.currentXp || 0) - cost;
    character.xp = character.totalXp || 0;
    await character.save();

    if (success) {
      item.enhanceLevel += 1;
      if (item.currentEffects && item.currentEffects.length > 0) {
        item.currentEffects = item.currentEffects.map((eff: any) => ({
          stat: eff.stat,
          value: getEnhancedValue(Math.round(eff.value / (1 + (item.enhanceLevel - 1) * 0.2)), item.enhanceLevel),
        }));
        item.currentEffect = { stat: item.currentEffects[0].stat, value: item.currentEffects[0].value, xpBonus: item.xpBonus || 0 };
      } else if (item.currentEffect) {
        const base = Math.round((item.currentEffect.value || 1) / (1 + (item.enhanceLevel - 1) * 0.2));
        item.currentEffect.value = getEnhancedValue(base, item.enhanceLevel);
      }
      await item.save();
      return res.json({ success: true, enhanced: true, item, cost, newLevel: item.enhanceLevel, currentXp: character.currentXp });
    } else {
      return res.json({ success: true, enhanced: false, item, cost, currentXp: character.currentXp, message: '강화 실패... 아이템은 유지됩니다.' });
    }
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// GET /api/inventory/:itemId/enhance-info
inventoryRouter.get('/:itemId/enhance-info', authenticateUser, async (req: Request, res: Response) => {
  try {
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId: req.user!.userId }).lean();
    if (!item) return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
    return res.json({
      currentLevel: item.enhanceLevel,
      cost: getEnhanceCost(item.enhanceLevel),
      successRate: Math.round(getEnhanceSuccessRate(item.enhanceLevel) * 100),
      maxLevel: item.enhanceLevel >= 10,
    });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});

// DELETE /api/inventory/:itemId
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
    return res.json({ success: true, refund, currentXp: character?.currentXp || 0, message: `${item.name}을(를) 분해하여 ${refund} XP를 획득했습니다.` });
  } catch (err) { return res.status(500).json({ error: String(err) }); }
});
