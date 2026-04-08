import admin from 'firebase-admin';
import { PushSubscription } from '../models/PushSubscription';

// Firebase 초기화 (한번만)
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

/**
 * 특정 유저에게 푸시 알림 전송
 */
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
        notification: { title, body },
        data: data || {},
        webpush: {
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          },
        },
      });
      sent++;
    } catch (err: any) {
      // 만료된 토큰 정리
      if (
        err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered'
      ) {
        tokensToRemove.push(sub.fcmToken);
      }
      console.error(`[Push] Failed for token ${sub.fcmToken.slice(0, 10)}...:`, err.code || err);
    }
  }

  // 만료 토큰 삭제
  if (tokensToRemove.length > 0) {
    await PushSubscription.deleteMany({ fcmToken: { $in: tokensToRemove } });
  }

  return sent;
}

/**
 * 모든 구독자에게 푸시 전송
 */
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

  // 500개씩 배치 전송
  const tokens = subs.map((s) => s.fcmToken);
  const batchSize = 500;

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: data || {},
        webpush: {
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          },
        },
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
 * 오늘 배치를 하지 않은 사용자에게 알림 전송
 */
export async function sendPushToUnplacedUsers(): Promise<number> {
  if (!admin.apps.length) return 0;

  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  // 오늘 배치한 유저 ID 목록
  const { Placement } = await import('../models/Placement');
  const placedUserIds = await Placement.distinct('userId', { date: today });

  // 배치 안 한 유저의 푸시 구독 찾기
  const subs = await PushSubscription.find({
    userId: { $nin: placedUserIds },
  }).lean();

  if (subs.length === 0) return 0;

  const tokens = subs.map((s) => s.fcmToken);
  const tokensToRemove: string[] = [];
  let sent = 0;
  const batchSize = 500;

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: {
          title: '🐾 비스트리그',
          body: '오늘 배치를 아직 안 했어요! 경기 시작 전에 배치하세요.',
        },
        data: { url: '/match' },
        webpush: {
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          },
        },
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
      console.error('[Push] Unplaced batch error:', err);
    }
  }

  if (tokensToRemove.length > 0) {
    await PushSubscription.deleteMany({ fcmToken: { $in: tokensToRemove } });
  }

  console.log(`[Push] Sent to ${sent} unplaced users (${subs.length} total subs)`);
  return sent;
}
