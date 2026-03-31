import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';

export const trainingsRouter = Router();

// 훈련 기능 비활성화 - 추후 재구현
trainingsRouter.post('/', authenticateUser, async (_req: Request, res: Response) => {
  return res.status(400).json({ error: '훈련 기능은 준비 중입니다' });
});

trainingsRouter.get('/today', authenticateUser, async (_req: Request, res: Response) => {
  return res.json([]);
});
