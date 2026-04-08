'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ANIMAL_EMOJI: Record<string, string> = {
  turtle: '🐢', eagle: '🦅', lion: '🦁', dinosaur: '🦖', dog: '🐶',
  fox: '🦊', penguin: '🐧', shark: '🦈', bear: '🐻', tiger: '🐯',
  seagull: '🕊️', dragon: '🐉', cat: '🐱', rabbit: '🐰',
  gorilla: '🦍', elephant: '🐘',
};

export default function RankingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rankings, setRankings] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchRankings();
  }, [token, status]);

  async function fetchRankings() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const [listRes, meRes] = await Promise.all([
        fetch(`${apiUrl}/api/rankings?type=level&limit=100`, { headers }),
        fetch(`${apiUrl}/api/rankings/me?type=level`, { headers }),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setRankings(Array.isArray(data) ? data : []);
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setMyRank(me?.rank ?? null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-4">
        <h1 className="text-gray-900 text-lg font-bold">XP 랭킹</h1>
      </div>

      {rankings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">아직 랭킹 데이터가 없습니다</p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {rankings.map((r: any, i: number) => {
            const emoji = ANIMAL_EMOJI[r.animalType] || '🐾';
            const xpValue = r.xp ?? 0;
            const isTop3 = i < 3;
            const placed = r.placedToday === true;

            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-2xl ${
                  isTop3 ? 'bg-orange-50 border border-orange-100' : 'bg-white border border-gray-100'
                }`}
              >
                <span className="w-8 text-center text-lg">
                  {isTop3 ? medals[i] : <span className="text-gray-400 text-xs font-bold">{i + 1}</span>}
                </span>
                <span className="text-2xl">{emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-gray-900 text-sm font-bold">{r.name || '???'}</p>
                    {placed ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
                        배치완료
                      </span>
                    ) : (
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                        미배치
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-orange-500 text-sm font-bold">{xpValue.toLocaleString()} XP</p>
              </div>
            );
          })}
        </div>
      )}

      {myRank && (
        <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
          <div className="bg-orange-400 rounded-2xl p-3 flex items-center justify-between shadow-lg">
            <span className="text-white text-sm font-bold">내 순위</span>
            <span className="text-white text-lg font-bold">{myRank}위</span>
          </div>
        </div>
      )}
    </div>
  );
}
