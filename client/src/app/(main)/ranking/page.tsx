'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useSession } from 'next-auth/react';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

const ANIMAL_EMOJI: Record<string, string> = {
  bear: '🐻', tiger: '🐯', eagle: '🦅', wolf: '🐺', dragon: '🐲',
};
const RANK_BORDER = ['border-yellow-400','border-gray-400','border-amber-600'];
const TABS = [
  { key: 'level',        label: '레벨' },
  { key: 'totalStats',   label: '총스탯' },
  { key: 'weeklyGrowth', label: '주간성장' },
  { key: 'battlePoints', label: '배틀포인트' },
];

interface RankEntry { userId?: string; _id?: string; name?: string; animalType?: string; level?: number; total?: number; totalGrowth?: number; totalPts?: number }

export default function RankingPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState('level');
  const [data, setData] = useState<RankEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<RankEntry[]>(`/api/rankings?type=${tab}&limit=100`),
      api.get<{ rank: number | null }>(`/api/rankings/me?type=${tab}`),
    ]).then(([list, me]) => {
      setData(list.data);
      setMyRank(me.data.rank);
    }).catch(() => { setData([]); setMyRank(null); })
      .finally(() => setLoading(false));
  }, [tab]);

  const getMainValue = (entry: RankEntry) => {
    if (tab === 'level') return `Lv.${entry.level}`;
    if (tab === 'totalStats') return `${entry.total ?? 0}`;
    if (tab === 'weeklyGrowth') return `+${(entry.totalGrowth ?? 0).toFixed(1)}`;
    return `${entry.totalPts ?? 0}pt`;
  };

  const top3 = data.slice(0, 3);
  const rest  = data.slice(3);

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto space-y-5">
      <h1 className="font-black text-xl">🏆 랭킹</h1>

      {/* 탭 */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap
              ${tab === t.key ? 'text-primary border-b-2 border-primary' : 'text-textSecondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center pt-10"><LoadingSpinner /></div>
      ) : data.length === 0 ? (
        <EmptyState emoji="🏆" title="랭킹 데이터가 없습니다" />
      ) : (
        <>
          {/* 상위 3명 */}
          <div className="grid grid-cols-3 gap-2">
            {top3.map((entry, i) => (
              <div key={String(entry._id ?? entry.userId ?? i)}
                className={`bg-surfaceLight rounded-2xl p-3 border-2 ${RANK_BORDER[i]} text-center`}>
                <p className="text-xl font-black text-textSecondary mb-1">#{i + 1}</p>
                <p className="text-3xl">{ANIMAL_EMOJI[entry.animalType ?? ''] ?? '🐾'}</p>
                <p className="text-xs font-semibold mt-1 truncate">{entry.name ?? '?'}</p>
                <p className="text-xs text-primary font-bold">{getMainValue(entry)}</p>
              </div>
            ))}
          </div>

          {/* 4위 이하 */}
          <div className="space-y-2">
            {rest.map((entry, i) => (
              <div key={String(entry._id ?? entry.userId ?? i)}
                className="bg-surfaceLight rounded-xl p-3 border border-white/10 flex items-center gap-3">
                <span className="w-8 text-center text-sm font-bold text-textSecondary">#{i + 4}</span>
                <span className="text-xl">{ANIMAL_EMOJI[entry.animalType ?? ''] ?? '🐾'}</span>
                <span className="flex-1 text-sm font-medium">{entry.name ?? '?'}</span>
                <span className="text-xs text-primary font-bold">{getMainValue(entry)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 내 순위 고정 바 */}
      {myRank && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-primary/90 backdrop-blur rounded-xl px-4 py-2.5 flex justify-between items-center text-sm font-semibold text-white">
          <span>내 순위</span>
          <span>#{myRank}</span>
        </div>
      )}
    </div>
  );
}
