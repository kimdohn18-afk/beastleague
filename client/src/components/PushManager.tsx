'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { requestFcmToken, onForegroundMessage } from '@/lib/firebase';

export default function PushManager() {
  const { data: session, status } = useSession();
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (status !== 'authenticated' || !token) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // 이미 권한이 granted인 경우에만 자동 토큰 갱신
    if (Notification.permission === 'granted') {
      registerToken();
    }

    async function registerToken() {
      try {
        const fcmToken = await requestFcmToken();
        if (!fcmToken) return;

        await fetch(`${apiUrl}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fcmToken }),
        });
        console.log('[Push] Token refreshed & subscribed');
      } catch (e) {
        console.error('[Push] Auto-refresh failed:', e);
      }
    }

    // 포그라운드 메시지 수신
    const unsub = onForegroundMessage((payload: any) => {
      const title = payload.notification?.title || '비스트리그';
      const body = payload.notification?.body || '';
      setToast({ title, body });
      setTimeout(() => setToast(null), 5000);
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [status, token]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-slide-down">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">{toast.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{toast.body}</p>
        </div>
        <button
          onClick={() => setToast(null)}
          className="text-gray-300 hover:text-gray-500 text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
