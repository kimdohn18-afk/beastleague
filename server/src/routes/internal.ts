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

// 테스트: 모든 구독자에게 알림 전송
internalRouter.post('/test-push-all', async (req: Request, res: Response) => {
  try {
    const { sendPushToAll } = await import('../services/pushService');
    const title = req.body.title || '🐾 비스트리그';
    const body = req.body.body || '테스트 알림입니다!';
    const count = await sendPushToAll(title, body);
    return res.json({ success: true, sent: count });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// 중복 토큰 정리
internalRouter.post('/cleanup-tokens', async (req: Request, res: Response) => {
  try {
    const { PushSubscription } = await import('../models/PushSubscription');
    const all = await PushSubscription.find().lean();
    
    const seen = new Set<string>();
    const duplicateIds: string[] = [];
    
    for (const sub of all) {
      const key = `${sub.userId}-${sub.fcmToken}`;
      if (seen.has(key)) {
        duplicateIds.push(sub._id.toString());
      } else {
        seen.add(key);
      }
    }
    
    // 같은 유저의 오래된 토큰도 정리 (유저당 최신 1개만 유지)
    const userTokens = new Map<string, { id: string; date: Date }>();
    for (const sub of all) {
      const uid = sub.userId.toString();
      const existing = userTokens.get(uid);
      if (!existing || sub.createdAt > existing.date) {
        if (existing) duplicateIds.push(existing.id);
        userTokens.set(uid, { id: sub._id.toString(), date: sub.createdAt });
      } else {
        duplicateIds.push(sub._id.toString());
      }
    }
    
    const deleted = await PushSubscription.deleteMany({ _id: { $in: duplicateIds } });
    const remaining = await PushSubscription.countDocuments();
    
    return res.json({ success: true, deleted: deleted.deletedCount, remaining });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// 구독자 통계 확인
internalRouter.get('/push-stats', async (req: Request, res: Response) => {
  try {
    const { PushSubscription } = await import('../models/PushSubscription');
    const total = await PushSubscription.countDocuments();
    const users = await PushSubscription.distinct('userId');
    return res.json({ totalTokens: total, uniqueUsers: users.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// 기존 유저 업적 일괄 계산
internalRouter.post('/recalculate-traits', async (req, res) => {
  try {
    const { Character } = await import('../models/Character');
    const { Placement } = await import('../models/Placement');
    const { calculateAchievements } = await import('../services/TraitCalculator');

    const characters = await Character.find({});
    let updated = 0;

    for (const character of characters) {
      const count = await Placement.countDocuments({ userId: character.userId, status: 'settled' });
      character.totalPlacements = count;
      character.tutorialCompleted = true;

      if (count >= 1) {
        const result = await calculateAchievements(String(character.userId), String(character._id));
        character.activeTrait = result.activeTrait
          ? `${result.activeTrait.emoji} ${result.activeTrait.name}`
          : null;
      }

      await character.save();
      updated++;
    }

    res.json({ success: true, updated });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// server/src/routes/internal.ts 에 추가

// POST /internal/games/:gameId/score — 경기 결과 입력 (수동)
internalRouter.post('/games/:gameId/score', async (req: Request, res: Response) => {
  try {
    const { homeScore, awayScore } = req.body;
    
    if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
      return res.status(400).json({ error: 'homeScore, awayScore (number) 필수' });
    }
    
    const game = await Game.findOneAndUpdate(
      { gameId: req.params.gameId },
      { 
        $set: { 
          homeScore, 
          awayScore, 
          status: 'finished' 
        } 
      },
      { new: true }
    );
    
    if (!game) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다' });
    }
    
    return res.json({ success: true, game });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
