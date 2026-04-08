import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { authenticateInternal } from '../middleware/internalAuth';
import { internalLimiter } from '../middleware/rateLimit';
import { Game } from '../models/Game';
import { validateGameData } from '../validator/GameDataValidator';
import { settleGame } from '../services/SettlementService';
import { GameData } from '@beastleague/shared';

export const internalRouter = Router();

internalRouter.use(internalLimiter);
internalRouter.use(authenticateInternal);

// POST /internal/games — GameData 또는 GameData[] upsert
internalRouter.post('/games', async (req: Request, res: Response) => {
  try {
    const body = req.body as GameData | GameData[];
    const items: GameData[] = Array.isArray(body) ? body : [body];

    const results = [];
    for (const item of items) {
      const { valid, errors } = validateGameData(item);
      if (!valid) {
        results.push({ gameId: item.gameId, success: false, errors });
        continue;
      }
      await Game.findOneAndUpdate(
        { gameId: item.gameId },
        { $set: item },
        { upsert: true, new: true }
      );
      results.push({ gameId: item.gameId, success: true });
    }
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /internal/games/:gameId/settle
internalRouter.post('/games/:gameId/settle', async (req: Request, res: Response) => {
  try {
    const io = req.app.locals.io as SocketIOServer;
    const result = await settleGame(req.params.gameId, io);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: String(err) });
  }
});

// 테스트: 미배치 유저에게 알림 전송
internalRouter.post('/test-push-reminder', async (req: Request, res: Response) => {
  try {
    const { sendPushToUnplacedUsers } = await import('../services/pushService');
    const count = await sendPushToUnplacedUsers();
    return res.json({ success: true, sent: count });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
