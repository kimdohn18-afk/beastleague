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

// 디버깅: 환경변수 확인
console.log('[Firebase] Config:', {
  apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.slice(0, 10) + '...' : 'EMPTY',
  projectId: firebaseConfig.projectId || 'EMPTY',
  messagingSenderId: firebaseConfig.messagingSenderId || 'EMPTY',
  appId: firebaseConfig.appId ? firebaseConfig.appId.slice(0, 15) + '...' : 'EMPTY',
});

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!messaging) {
    try {
      messaging = getMessaging(app);
      console.log('[Firebase] Messaging instance created');
    } catch (e) {
      console.error('[Firebase] Messaging init failed:', e);
      return null;
    }
  }
  return messaging;
}

export async function requestFcmToken(): Promise<string | null> {
  try {
    console.log('[Push] Step 1: Requesting permission...');
    const permission = await Notification.requestPermission();
    console.log('[Push] Step 2: Permission result:', permission);
    if (permission !== 'granted') {
      console.log('[Push] Permission denied');
      return null;
    }

    console.log('[Push] Step 3: Getting messaging instance...');
    const m = getMessagingInstance();
    if (!m) {
      console.error('[Push] Step 3 FAILED: No messaging instance');
      return null;
    }

    console.log('[Push] Step 4: Registering service worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[Push] Step 5: SW registered, state:', registration.active?.state);
    
    // SW가 활성화될 때까지 대기
    if (!registration.active) {
      console.log('[Push] Step 5b: Waiting for SW to activate...');
      await navigator.serviceWorker.ready;
      console.log('[Push] Step 5c: SW ready');
    }

    registration.active?.postMessage({
      type: 'FIREBASE_CONFIG',
      config: firebaseConfig,
    });
    console.log('[Push] Step 6: Config sent to SW');

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';
    console.log('[Push] Step 7: VAPID key:', vapidKey ? vapidKey.slice(0, 15) + '...' : 'EMPTY');
    
    const token = await getToken(m, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    console.log('[Push] Step 8: Token result:', token ? token.slice(0, 20) + '...' : 'NULL');

    return token || null;
  } catch (err) {
    console.error('[Push] Token request failed:', err);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  const m = getMessagingInstance();
  if (!m) return null;
  return onMessage(m, callback);
}
