import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';

export const statsRouter = Router();

// 능력치 시스템 — 추후 구현 예정
statsRouter.get('/', authenticateUser, async (_req: Request, res: Response) => {
  return res.json({
    stats: { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 },
    upgradeCosts: { power: 10, agility: 10, skill: 10, stamina: 10, mind: 10 },
    totalStats: 5,
    currentXp: 0,
    totalXp: 0,
    message: '능력치 시스템은 준비 중입니다',
  });
});

statsRouter.post('/upgrade', authenticateUser, async (_req: Request, res: Response) => {
  return res.status(400).json({ error: '능력치 시스템은 준비 중입니다' });
});
