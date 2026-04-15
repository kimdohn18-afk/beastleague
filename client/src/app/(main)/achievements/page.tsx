'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Achievement {
  id: string;
  emoji: string;
  name: string;
  category: string;
  description: string;
  condition: string;
  earned: boolean;
}

interface TeamAchievement {
  teamId: string;
  teamName: string;
  teamEmoji: string;
  tier: { tier: string; minCount: number; emoji: string; label: string };
  count: number;
}

interface AchievementData {
  activeTrait: { id: string; emoji: string; name: string; description: string } | null;
  earnedCount: number;
  totalCount: number;
  achievements: Achievement[];
  teamAchievements: TeamAchievement[];
}

const CATEGORY_LABELS: Record<string, { emoji: string; name: string }> = {
  beginner: { emoji: '👣', name: '입문' },
  xp: { emoji: '🌱', name: 'XP 성장' },
  prediction: { emoji: '🎯', name: '예측' },
  batting: { emoji: '⚾', name: '타격 이벤트' },
  stats: { emoji: '📊', name: '누적 스탯' },
  streak: { emoji: '🔥', name: '스트릭' },
  singleGame: { emoji: '💥', name: '한방' },
  explore: { emoji: '🧭', name: '탐험' },
  collection: { emoji: '📦', name: '수집' },
  adversity: { emoji: '😤', name: '역경' },
};

const TIER_COLORS: Record<string, string> = {
  bronze: 'border-amber-600 bg-amber-50',
  silver: 'border-gray-400 bg-gray-50',
  gold: 'border-yellow-400 bg-yellow-50',
  diamond: 'border-blue-400 bg-blue-50',
};

const TIER_LABELS: Record<string, string> = {
  bronze: '🥉 동',
  silver: '🥈 은',
  gold: '🥇 금',
  diamond: '💎 다이아',
};

const ALL_TEAMS = [
  { id: 'samsung', name: '삼성 라이온즈', emoji: '🦁' },
  { id: 'kia', name: '기아 타이거즈', emoji: '🐯' },
  { id: 'lg', name: 'LG 트윈스', emoji: '🤞' },
  { id: 'doosan', name: '두산 베어스', emoji: '🐻' },
  { id: 'kt', name: 'KT 위즈', emoji: '🧙' },
  { id: 'ssg', name: 'SSG 랜더스', emoji: '🛬' },
  { id: 'lotte', name: '롯데 자이언츠', emoji: '🦅' },
  { id: 'hanwha', name: '한화 이글스', emoji: '🦅' },
  { id: 'nc', name: 'NC 다이노스', emoji: '🦕' },
  { id: 'kiwoom', name: '키움 히어로즈', emoji: '🦸' },
];

export default function AchievementsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AchievementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ team: typeof ALL_TEAMS[0]; achievement?: TeamAchievement } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;
  const [settingTrait, setSettingTrait] = useState(false);

  
  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [token]);

  async function fetchData() {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me/achievements`, {
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
        <p className="text-gray-400 text-sm">업적 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  const categories = ['beginner', 'xp', 'prediction', 'batting', 'stats', 'streak', 'singleGame', 'explore', 'collection', 'adversity'];
  const grouped = categories.map(cat => ({
    ...CATEGORY_LABELS[cat],
    key: cat,
    achievements: data.achievements.filter(a => a.category === cat),
  }));

  const progressPercent = Math.round((data.earnedCount / data.totalCount) * 100);

  // 팀 업적 맵
  const teamAchMap: Record<string, TeamAchievement> = {};
  for (const ta of data.teamAchievements) {
    teamAchMap[ta.teamId] = ta;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-gray-400 text-sm mb-3">← 돌아가기</button>
        <h1 className="text-xl font-bold text-gray-800">업적</h1>
        <p className="text-sm text-gray-400 mt-1">
          {data.earnedCount} / {data.totalCount} 달성 ({progressPercent}%)
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
            <p className="text-xs text-gray-400 mt-1">&ldquo;{data.activeTrait.description}&rdquo;</p>
          </div>
        )}
      </div>

      {/* 일반 업적 */}
      <div className="px-4 mt-2 space-y-6">
        {grouped.map(group => (
          <div key={group.key}>
            <h2 className="text-sm font-bold text-gray-600 mb-3">
              {group.emoji} {group.name}
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {group.achievements.map(ach => (
                <button
                  key={ach.id}
                  onClick={() => setSelectedAchievement(ach)}
                  className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                    ach.earned
                      ? 'bg-white border-gray-200 shadow-sm active:scale-95'
                      : 'bg-gray-100 border-gray-100 opacity-40'
                  }`}
                >
                  <span className={`text-2xl ${ach.earned ? '' : 'grayscale'}`}>
                    {ach.earned ? ach.emoji : '🔒'}
                  </span>
                  <span className={`text-[10px] mt-1 text-center leading-tight ${
                    ach.earned ? 'text-gray-700 font-medium' : 'text-gray-400'
                  }`}>
                    {ach.earned ? ach.name : '???'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* 팀 충성도 */}
        <div>
          <h2 className="text-sm font-bold text-gray-600 mb-3">❤️ 팀 충성도</h2>
          <div className="grid grid-cols-5 gap-2">
            {ALL_TEAMS.map(team => {
              const ta = teamAchMap[team.id];
              const tierClass = ta ? TIER_COLORS[ta.tier.tier] : 'border-gray-200 bg-gray-100';
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam({ team, achievement: ta })}
                  className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all active:scale-95 ${tierClass} ${!ta ? 'opacity-40' : ''}`}
                >
                  <span className="text-2xl">{team.emoji}</span>
                  <span className="text-[9px] mt-1 text-center leading-tight text-gray-600 font-medium">
                    {team.name.split(' ')[0]}
                  </span>
                  {ta && (
                    <span className="text-[9px] mt-0.5">{TIER_LABELS[ta.tier.tier]}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 일반 업적 모달 */}
      {selectedAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedAchievement(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-[85%] max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className={`text-5xl mb-3 ${selectedAchievement.earned ? '' : 'grayscale opacity-40'}`}>
              {selectedAchievement.earned ? selectedAchievement.emoji : '🔒'}
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {selectedAchievement.earned ? selectedAchievement.name : '???'}
            </h3>
            {selectedAchievement.earned && (
              <p className="text-sm text-gray-500 mb-3">&ldquo;{selectedAchievement.description}&rdquo;</p>
            )}
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <p className="text-xs text-gray-400 mb-1">달성 조건</p>
              <p className="text-sm text-gray-700 font-medium">{selectedAchievement.condition}</p>
            </div>
            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                selectedAchievement.earned ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-400'
              }`}>
                {selectedAchievement.earned ? '✅ 달성 완료' : '🔒 미달성'}
              </span>
            </div>
            <button onClick={() => setSelectedAchievement(null)} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200">
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 팀 업적 모달 */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedTeam(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-[85%] max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-2">{selectedTeam.team.emoji}</div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{selectedTeam.team.name}</h3>

            {selectedTeam.achievement ? (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  현재 등급: <span className="font-bold">{TIER_LABELS[selectedTeam.achievement.tier.tier]}</span>
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  배치 횟수: {selectedTeam.achievement.count}회
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mb-4">아직 이 팀에 배치한 적이 없습니다</p>
            )}

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-400 mb-2">등급 기준</p>
              <div className="space-y-1">
                {[
                  { label: '🥉 동', count: 1 },
                  { label: '🥈 은', count: 5 },
                  { label: '🥇 금', count: 15 },
                  { label: '💎 다이아', count: 30 },
                ].map(t => {
                  const current = selectedTeam.achievement?.count ?? 0;
                  const achieved = current >= t.count;
                  return (
                    <div key={t.label} className={`flex justify-between text-sm px-2 py-1 rounded ${achieved ? 'text-gray-800' : 'text-gray-300'}`}>
                      <span>{t.label}</span>
                      <span>{t.count}회 {achieved ? '✅' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={() => setSelectedTeam(null)} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
