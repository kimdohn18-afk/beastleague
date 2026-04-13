'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Badge {
  id: string;
  emoji: string;
  name: string;
  category: string;
  description: string;
  condition: string;
  earned: boolean;
}

interface BadgeData {
  activeTrait: { id: string; emoji: string; name: string; description: string } | null;
  earnedCount: number;
  totalCount: number;
  badges: Badge[];
}

const CATEGORY_LABELS: Record<string, { emoji: string; name: string }> = {
  achievement: { emoji: '🏆', name: '성과' },
  batting: { emoji: '⚾', name: '타순 전략' },
  team: { emoji: '❤️', name: '팀 성향' },
  streak: { emoji: '🔥', name: '연속성' },
  special: { emoji: '💎', name: '특수' },
};

export default function BadgesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (!token) return;
    fetchBadges();
  }, [token]);

  async function fetchBadges() {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me/badges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">뱃지 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  const categories = ['achievement', 'batting', 'team', 'streak', 'special'];
  const grouped = categories.map(cat => ({
    ...CATEGORY_LABELS[cat],
    key: cat,
    badges: data.badges.filter(b => b.category === cat),
  }));

  const progressPercent = Math.round((data.earnedCount / data.totalCount) * 100);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-gray-400 text-sm mb-3">← 돌아가기</button>
        <h1 className="text-xl font-bold text-gray-800">뱃지 컬렉션</h1>
        <p className="text-sm text-gray-400 mt-1">
          {data.earnedCount} / {data.totalCount} 획득 ({progressPercent}%)
        </p>

        <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-orange-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {data.activeTrait && (
          <div className="mt-4 bg-white rounded-2xl p-4 border border-orange-200 shadow-sm">
            <p className="text-xs text-orange-400 font-bold mb-1">대표 칭호</p>
            <p className="text-lg">
              {data.activeTrait.emoji} <span className="font-bold text-gray-800">{data.activeTrait.name}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">"{data.activeTrait.description}"</p>
          </div>
        )}
      </div>

      <div className="px-4 mt-2 space-y-6">
        {grouped.map(group => (
          <div key={group.key}>
            <h2 className="text-sm font-bold text-gray-600 mb-3">
              {group.emoji} {group.name}
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {group.badges.map(badge => (
                <button
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                    badge.earned
                      ? 'bg-white border-gray-200 shadow-sm active:scale-95'
                      : 'bg-gray-100 border-gray-100 opacity-40'
                  }`}
                >
                  <span className={`text-2xl ${badge.earned ? '' : 'grayscale'}`}>
                    {badge.earned ? badge.emoji : '🔒'}
                  </span>
                  <span className={`text-[10px] mt-1 text-center leading-tight ${
                    badge.earned ? 'text-gray-700 font-medium' : 'text-gray-400'
                  }`}>
                    {badge.earned ? badge.name : '???'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

     {selectedBadge && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedBadge(null)}>
    <div className="bg-white rounded-2xl shadow-xl w-[85%] max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
      <div className={`text-5xl mb-3 ${selectedBadge.earned ? '' : 'grayscale opacity-40'}`}>
        {selectedBadge.earned ? selectedBadge.emoji : '🔒'}
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-1">
        {selectedBadge.earned ? selectedBadge.name : '???'}
      </h3>
      {selectedBadge.earned && (
        <p className="text-sm text-gray-500 mb-3">"{selectedBadge.description}"</p>
      )}
      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <p className="text-xs text-gray-400 mb-1">해금 조건</p>
        <p className="text-sm text-gray-700 font-medium">{selectedBadge.condition}</p>
      </div>
      <div className="mb-4">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
          selectedBadge.earned ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-400'
        }`}>
          {selectedBadge.earned ? '✅ 획득 완료' : '🔒 미획득'}
        </span>
      </div>
      <button onClick={() => setSelectedBadge(null)} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200">
        닫기
      </button>
    </div>
  </div>
)}
