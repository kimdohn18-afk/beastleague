'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RankingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('level');
  const [rankings, setRankings] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const tabs = [
    { key: 'level', label: '레벨' },
    { key: 'totalStats', label: '총스탯' },
    { key: 'weeklyGrowth', label: '주간성장' },
    { key: 'battlePoints', label: '배틀점수' },
  ];

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${apiUrl}/api/rankings?type=${tab}&limit=100`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${apiUrl}/api/rankings/me?type=${tab}`, { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([list, me]) => {
      setRankings(Array.isArray(list) ? list : []);
      setMyRank(me);
    }).catch(console.error).finally(() => setLoading(false));
  }, [tab, token, status]);

  if (status === 'loading') return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-textSecondary">로딩 중...</p></div>;

  const medals = ['🥇', '🥈', '🥉'];
  const animals: Record<string,string> = { bear:'🐻', tiger:'🐯', eagle:'🦅', wolf:'🐺', dragon:'🐲' };

  return (
    <div className="min-h-screen bg-surface p-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.push('/')} className="text-textSecondary text-xl">←</button>
        <h1 className="text-lg font-bold text-textPrimary">랭킹</h1>
      </div>

      <div className="flex gap-1 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab===t.key?'bg-primary text-white':'bg-surfaceLight text-textSecondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-textSecondary py-8">로딩 중...</p>
      ) : rankings.length === 0 ? (
        <p className="text-center text-textSecondary py-8">랭킹 데이터가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {rankings.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${i < 3 ? 'bg-surfaceLight ring-1 ring-primary/30' : 'bg-surfaceLight'}`}>
              <span className="w-8 text-center text-lg">{i < 3 ? medals[i] : <span className="text-xs text-textSecondary">{i+1}</span>}</span>
              <span className="text-2xl">{animals[r.animalType] || '🐾'}</span>
              <div className="flex-1">
                <p className="text-sm text-textPrimary font-bold">{r.name || r.characterName}</p>
                <p className="text-xs text-textSecondary">Lv.{r.level}</p>
              </div>
              <p className="text-sm text-primary font-mono font-bold">{r.value?.toFixed?.(1) || r.value || 0}</p>
            </div>
          ))}
        </div>
      )}

      {myRank && (
        <div className="fixed bottom-16 left-0 right-0 px-4">
          <div className="bg-primary/20 backdrop-blur rounded-xl p-3 flex items-center gap-3">
            <span className="text-sm font-bold text-primary">내 순위: {myRank.rank}위</span>
            <span className="flex-1 text-right text-sm text-textPrimary font-mono">{myRank.value?.toFixed?.(1) || myRank.value || 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}
