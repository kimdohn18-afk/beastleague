'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BattlePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [todayBattle, setTodayBattle] = useState<any>(null);
  const [recentBattles, setRecentBattles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    Promise.all([
      fetch(`${apiUrl}/api/battles/today`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/api/battles/history?limit=5`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([today, recent]) => {
      setTodayBattle(today);
      setRecentBattles(Array.isArray(recent) ? recent : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [token, status]);

  if (status === 'loading' || loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-textSecondary">로딩 중...</p></div>;

  const resultColor = (r: string) => r === 'win' ? 'text-green-400' : r === 'lose' ? 'text-red-400' : 'text-yellow-400';
  const resultText = (r: string) => r === 'win' ? '승리!' : r === 'lose' ? '패배' : '무승부';

  return (
    <div className="min-h-screen bg-surface p-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.push('/')} className="text-textSecondary text-xl">←</button>
        <h1 className="text-lg font-bold text-textPrimary">대결</h1>
      </div>

      {todayBattle ? (
        <div className="bg-surfaceLight rounded-xl p-6 mb-4">
          <p className="text-center text-xs text-textSecondary mb-3">오늘의 대결</p>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <span className="text-4xl">🐾</span>
              <p className="text-sm text-textPrimary font-bold mt-1">나</p>
              <p className="text-xs text-textSecondary">총합 {todayBattle.myTotalStats?.toFixed(1) || '?'}</p>
            </div>
            <div className="text-center px-4">
              <p className={`text-3xl font-black ${resultColor(todayBattle.result)}`}>{resultText(todayBattle.result)}</p>
              <p className="text-xs text-textSecondary mt-1">XP +{todayBattle.xpGained || 0}</p>
            </div>
            <div className="text-center flex-1">
              <span className="text-4xl">👤</span>
              <p className="text-sm text-textPrimary font-bold mt-1">상대</p>
              <p className="text-xs text-textSecondary">총합 {todayBattle.opponentTotalStats?.toFixed(1) || '?'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surfaceLight rounded-xl p-6 text-center mb-4">
          <span className="text-4xl">⚔️</span>
          <p className="text-textSecondary mt-2">오늘 배틀이 없습니다</p>
          <p className="text-xs text-textSecondary mt-1">경기 정산 후 자동 생성됩니다</p>
        </div>
      )}

      <h3 className="text-sm font-bold text-textPrimary mb-2">최근 대결</h3>
      {recentBattles.length === 0 ? (
        <p className="text-center text-textSecondary text-sm py-4">대결 기록이 없습니다</p>
      ) : (
        <div className="space-y-2">
          {recentBattles.map((b, i) => (
            <div key={i} className="bg-surfaceLight rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-textSecondary">{new Date(b.createdAt || b.date).toLocaleDateString('ko-KR')}</p>
                <p className={`text-sm font-bold ${resultColor(b.result)}`}>{resultText(b.result)}</p>
              </div>
              <p className="text-xs text-textSecondary">XP +{b.xpGained || 0}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
