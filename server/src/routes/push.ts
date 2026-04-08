import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { PushSubscription } from '../models/PushSubscription';

export const pushRouter = Router();

// POST /api/push/subscribe — FCM 토큰 등록
pushRouter.post('/subscribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { fcmToken } = req.body as { fcmToken: string };

    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken 필수' });
    }

    // 같은 유저의 기존 토큰 모두 삭제
    await PushSubscription.deleteMany({ userId });

    // 새 토큰 등록
    await PushSubscription.findOneAndUpdate(
      { fcmToken },
      { userId, fcmToken },
      { upsert: true, new: true }
    );

    return res.json({ message: '구독 완료' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/push/unsubscribe — FCM 토큰 삭제
pushRouter.delete('/unsubscribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { fcmToken } = req.body as { fcmToken: string };
    if (fcmToken === 'all') {
      await PushSubscription.deleteMany({ userId });
    } else if (fcmToken) {
      await PushSubscription.deleteOne({ fcmToken });
    }
    return res.json({ message: '구독 해제' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
