import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.error('[Firebase] Messaging init failed:', e);
      return null;
    }
  }
  return messaging;
}

/**
 * FCM 토큰 발급 (알림 권한 요청 포함)
 */
export async function requestFcmToken(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permission denied');
      return null;
    }

    const m = getMessagingInstance();
    if (!m) return null;

    // 서비스 워커에 Firebase config 전달
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    // config를 서비스 워커에 전달
    registration.active?.postMessage({
      type: 'FIREBASE_CONFIG',
      config: firebaseConfig,
    });

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
    const token = await getToken(m, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (err) {
    console.error('[Push] Token request failed:', err);
    return null;
  }
}

/**
 * 포그라운드 메시지 리스너
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  const m = getMessagingInstance();
  if (!m) return null;
  return onMessage(m, callback);
}
