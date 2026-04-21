'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  power: number;
  agility: number;
  skill: number;
  stamina: number;
  mind: number;
}

interface StatsData {
  stats: Stats;
  upgradeCosts: Record<string, number>;
  totalStats: number;
  currentXp: number;
  totalXp: number;
}

const STAT_INFO: Record<string, { emoji: string; name: string; desc: string }> = {
  power:   { emoji: '💪', name: '파워',  desc: '타격력에 영향' },
  agility: { emoji: '⚡', name: '민첩',  desc: '주루·수비에 영향' },
  skill:   { emoji: '🎯', name: '기술',  desc: '컨택·제구에 영향' },
  stamina: { emoji: '❤️', name: '체력',  desc: '지구력에 영향' },
  mind:    { emoji: '🧠', name: '정신',  desc: '집중력에 영향' },
};

export default function StatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (token) fetchStats();
  }, [token, status]);

  async function fetchStats() {
    try {
      const res = await fetch(`${apiUrl}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(stat: string) {
    if (upgrading || !data) return;
    const cost = data.upgradeCosts[stat];
    if (data.currentXp < cost) {
      setToast(`보유 XP가 부족합니다 (${cost} XP 필요)`);
      setTimeout(() => setToast(''), 2500);
      return;
    }

    setUpgrading(stat);
    try {
      const res = await fetch(`${apiUrl}/api/stats/upgrade`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stat }),
      });
      const result = await res.json();
      if (res.ok) {
        setData(prev => prev ? {
          ...prev,
          stats: result.stats,
          currentXp: result.currentXp,
          upgradeCosts: {
            ...prev.upgradeCosts,
            [stat]: prev.upgradeCosts[stat] + 5,
          },
          totalStats: Object.values(result.stats as Stats).reduce((a: number, b: number) => a + b, 0),
        } : prev);
        const info = STAT_INFO[stat];
        setToast(`${info.emoji} ${info.name} Lv.${result.newLevel}! (-${result.cost} XP)`);
        setTimeout(() => setToast(''), 2500);
      } else {
        setToast(result.error || '업그레이드 실패');
        setTimeout(() => setToast(''), 2500);
      }
    } catch {
      setToast('네트워크 오류');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setUpgrading(null);
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  const maxStat = Math.max(...Object.values(data.stats), 10);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-4">
        <h1 className="text-lg font-bold text-gray-900">능력치</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
            보유 {data.currentXp.toLocaleString()} XP
          </span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            총 능력치 {data.totalStats}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {Object.entries(STAT_INFO).map(([key, info]) => {
          const level = data.stats[key as keyof Stats];
          const cost = data.upgradeCosts[key];
          const canAfford = data.currentXp >= cost;
          const barWidth = (level / maxStat) * 100;

          return (
            <div key={key} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{info.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{info.name}</p>
                    <p className="text-[10px] text-gray-400">{info.desc}</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-orange-500">Lv.{level}</span>
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
                <div
                  className="bg-orange-400 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(barWidth, 100)}%` }}
                />
              </div>

              <button
                onClick={() => handleUpgrade(key)}
                disabled={!canAfford || upgrading === key}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                  canAfford
                    ? 'bg-orange-400 text-white active:scale-[0.98] shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {upgrading === key ? '업그레이드 중...' : `업그레이드 (${cost} XP)`}
              </button>
            </div>
          );
        })}
      </div>

      {/* 능력치 설명 */}
      <div className="px-4 mt-6">
        <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
          <p className="text-xs font-bold text-orange-600 mb-1">💡 능력치란?</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            능력치는 경기 뛰기에서 결과에 영향을 줍니다.
            파워가 높으면 타격이 강해지고, 민첩이 높으면 수비와 주루가 좋아집니다.
            보유 XP를 투자해서 능력치를 올려보세요!
          </p>
        </div>
      </div>
    </div>
  );
}
