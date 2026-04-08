import admin from 'firebase-admin';
import { PushSubscription } from '../models/PushSubscription';

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
      });
      console.log('[Firebase] Initialized');
    } catch (e) {
      console.error('[Firebase] Init failed:', e);
    }
  } else {
    console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT not set, push disabled');
  }
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (!admin.apps.length) return 0;

  const subs = await PushSubscription.find({ userId }).lean();
  if (subs.length === 0) return 0;

  let sent = 0;
  const tokensToRemove: string[] = [];

  for (const sub of subs) {
    try {
      await admin.messaging().send({
        token: sub.fcmToken,
        data: { ...(data || {}), title, body },
        webpush: { fcmOptions: {} },
      });
      sent++;
    } catch (err: any) {
      if (
        err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered'
      ) {
        tokensToRemove.push(sub.fcmToken);
      }
      console.error(`[Push] Failed for token ${sub.fcmToken.slice(0, 10)}...:`, err.code || err);
    }
  }

  if (tokensToRemove.length > 0) {
    await PushSubscription.deleteMany({ fcmToken: { $in: tokensToRemove } });
  }

  return sent;
}

export async function sendPushToAll(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (!admin.apps.length) return 0;

  const subs = await PushSubscription.find().lean();
  if (subs.length === 0) return 0;

  let sent = 0;
  const tokensToRemove: string[] = [];
  const tokens = subs.map((s) => s.fcmToken);
  const batchSize = 500;

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        data: { ...(data || {}), title, body },
        webpush: { fcmOptions: {} },
      });
      sent += res.successCount;
      res.responses.forEach((r, idx) => {
        if (
          r.error &&
          (r.error.code === 'messaging/invalid-registration-token' ||
            r.error.code === 'messaging/registration-token-not-registered')
        ) {
          tokensToRemove.push(batch[idx]);
        }
      });
    } catch (err) {
      console.error('[Push] Batch send error:', err);
    }
  }

  if (tokensToRemove.length > 0) {
    await PushSubscription.deleteMany({ fcmToken: { $in: tokensToRemove } });
  }

  return sent;
}

/**
 * 미배치 유저에게 개인화 알림 전송
 * streak에 따라 다른 메시지를 보냄
 */
export async function sendPushToUnplacedUsers(): Promise<number> {
  if (!admin.apps.length) return 0;

  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const { Placement } = await import('../models/Placement');
  const { Character } = await import('../models/Character');

  const placedUserIds = await Placement.distinct('userId', { date: today });

  const subs = await PushSubscription.find({
    userId: { $nin: placedUserIds },
  }).lean();

  if (subs.length === 0) return 0;

  // 유저별로 캐릭터 정보(streak) 조회
  const userIds = [...new Set(subs.map((s) => s.userId.toString()))];
  const characters = await Character.find({ userId: { $in: userIds } }).lean();
  const charMap = new Map(characters.map((c) => [c.userId.toString(), c]));

  let sent = 0;
  const tokensToRemove: string[] = [];

  // 유저별 개인화 메시지 전송
  for (const sub of subs) {
    const char = charMap.get(sub.userId.toString());
    const streak = char?.streak || 0;

    let body: string;
    if (streak === 0) {
      body = '오늘 첫 배치를 해보세요!';
    } else if (streak >= 29) {
      body = `🔥 ${streak}일 연속 배치 중! 내일이면 30일 보너스 +200 XP!`;
    } else if (streak >= 13) {
      body = `🔥 ${streak}일 연속 배치 중! 14일 보너스까지 ${14 - streak}일 남았어요!`;
    } else if (streak >= 6) {
      body = `🔥 ${streak}일 연속 배치 중! 7일 보너스까지 ${7 - streak}일 남았어요!`;
    } else if (streak >= 2) {
      body = `🔥 ${streak}일 연속 배치 중! 3일째부터 보너스 시작이에요!`;
    } else {
      body = `어제 배치했어요! 오늘도 하면 ${streak + 1}일 연속이에요!`;
    }

    try {
      await admin.messaging().send({
        token: sub.fcmToken,
        data: {
          title: '🐾 비스트리그',
          body,
          url: '/match',
        },
        webpush: { fcmOptions: {} },
      });
      sent++;
    } catch (err: any) {
      if (
        err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered'
      ) {
        tokensToRemove.push(sub.fcmToken);
      }
    }
  }

  if (tokensToRemove.length > 0) {
    await PushSubscription.deleteMany({ fcmToken: { $in: tokensToRemove } });
  }

  console.log(`[Push] Sent personalized reminders to ${sent} unplaced users`);
  return sent;
}
