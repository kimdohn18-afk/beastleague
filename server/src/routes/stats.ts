import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { Character } from '../models/Character';

export const statsRouter = Router();

// 능력치별 투자 비용 (레벨별로 증가)
function getUpgradeCost(currentLevel: number): number {
  // 1→2: 10XP, 2→3: 15XP, ... 점점 비싸짐
  return 10 + (currentLevel - 1) * 5;
}

const VALID_STATS = ['power', 'agility', 'skill', 'stamina', 'mind'] as const;
type StatName = typeof VALID_STATS[number];

// POST /api/stats/upgrade — 능력치 1 올리기
statsRouter.post('/upgrade', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { stat } = req.body as { stat: StatName };

    if (!stat || !VALID_STATS.includes(stat)) {
      return res.status(400).json({ error: '유효하지 않은 능력치입니다. power, agility, skill, stamina, mind 중 선택하세요.' });
    }

    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const currentLevel = character.stats?.[stat] || 1;
    const cost = getUpgradeCost(currentLevel);

    if ((character.currentXp || 0) < cost) {
      return res.status(400).json({
        error: `보유 XP가 부족합니다 (${cost} XP 필요, 보유 ${character.currentXp || 0} XP)`,
        code: 'insufficientXp',
        cost,
        currentXp: character.currentXp || 0,
      });
    }

    // XP 차감 (currentXp만, totalXp 유지)
    character.currentXp = (character.currentXp || 0) - cost;
    character.stats[stat] = currentLevel + 1;

    // xp도 동기화 (하위호환)
    character.xp = character.totalXp || 0;

    await character.save();

    return res.json({
      success: true,
      stat,
      newLevel: currentLevel + 1,
      cost,
      currentXp: character.currentXp,
      stats: character.stats,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// GET /api/stats — 내 능력치 + 다음 업그레이드 비용 조회
statsRouter.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const character = await Character.findOne({ userId });
    if (!character) {
      return res.status(404).json({ error: '캐릭터가 없습니다' });
    }

    const stats = character.stats || { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 };
    const upgradeCosts: Record<string, number> = {};
    for (const s of VALID_STATS) {
      upgradeCosts[s] = getUpgradeCost(stats[s] || 1);
    }

    const totalStats = Object.values(stats).reduce((a, b) => a + b, 0);

    return res.json({
      stats,
      upgradeCosts,
      totalStats,
      currentXp: character.currentXp || 0,
      totalXp: character.totalXp || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
