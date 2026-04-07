'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

interface Character {
  _id: string;
  name: string;
  animalType: string;
  xp: number;
  userId: string;
}

interface Placement {
  _id: string;
  date: string;
  status: string;
  team: string;
  battingOrder: number;
  predictedWinner: string;
  isCorrect?: boolean;
  xpFromPlayer: number;
  xpFromPrediction: number;
  xpBreakdown?: {
    hits: number;
    rbi: number;
    runs: number;
    noHitPenalty: number;
    homeRun: number;
    double: number;
    triple: number;
    stolenBase: number;
    caughtStealing: number;
    walkOff: number;
    teamResult: number;
    total: number;
  };
  game?: {
    homeTeam: string;
    awayTeam: string;
    status: string;
  };
}

const MILESTONES = [
  { xp: 500, label: '루키', reward: '기본 테두리' },
  { xp: 1500, label: '레귤러', reward: '실버 테두리' },
  { xp: 3000, label: '올스타', reward: '골드 테두리' },
  { xp: 5000, label: 'MVP', reward: '특별 이펙트' },
  { xp: 10000, label: '전설', reward: '레전드 칭호' },
];

const ANIMAL_NAMES: Record<string, string> = {
  dragon: '드래곤',
  cat: '고양이',
  dog: '강아지',
  bear: '곰',
  rabbit: '토끼',
};

const ANIMAL_EMOJI: Record<string, string> = {
  dragon: '🐉',
  cat: '🐱',
  dog: '🐶',
  bear: '🐻',
  rabbit: '🐰',
};

function getLevel(xp: number): number {
  return Math.floor(xp / 1000) + 1;
}

export default function MainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    if (status === 'authenticated' && token) {
      fetchData();
    }
  }, [status, token]);

  const fetchData = async () => {
    try {
      const [charRes, placementsRes] = await Promise.all([
        fetch(`${apiUrl}/api/characters/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/placements/history`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!charRes.ok) {
        if (charRes.status === 404) {
          router.push('/character');
          return;
        }
        throw new Error('Failed to fetch character');
      }

      const charData = await charRes.json();
      setCharacter(charData);

      if (placementsRes.ok) {
        setPlacements(await placementsRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">캐릭터를 불러올 수 없습니다</p>
        <LogoutButton />
      </div>
    );
  }

  const level = getLevel(character.xp);
  const xpInLevel = character.xp % 1000;
  const settled = placements.filter((p) => p.status === 'settled');
  const totalXp = character.xp;
  const correctCount = settled.filter((p) => p.isCorrect).length;
  const accuracy = settled.length > 0 ? Math.round((correctCount / settled.length) * 100) : 0;

  // 시즌 타율 계산
  let totalAtBats = 0;
  let totalHits = 0;
  for (const p of settled) {
    if (p.xpBreakdown) {
      const hits = p.xpBreakdown.hits / 8;
      totalHits += hits;
      // 타수 추정: 안타 + (무안타패널티가 있으면 최소 3타수)
      if (p.xpBreakdown.noHitPenalty < 0) {
        totalAtBats += 3;
      } else if (hits > 0) {
        totalAtBats += Math.max(hits, 1);
      }
    }
  }
  const seasonAvg = totalAtBats > 0 ? (totalHits / totalAtBats).toFixed(3) : '.000';

  // 최근 정산 결과
  const recentSettled = settled[0];
  const recentXp = recentSettled
    ? recentSettled.xpFromPlayer + recentSettled.xpFromPrediction
    : null;

  // 마일스톤
  const currentMilestone = MILESTONES.find((m) => totalXp < m.xp) || MILESTONES[MILESTONES.length - 1];
  const prevMilestoneXp = MILESTONES[MILESTONES.indexOf(currentMilestone) - 1]?.xp || 0;
  const milestoneProgress = totalXp >= currentMilestone.xp
    ? 100
    : Math.round(((totalXp - prevMilestoneXp) / (currentMilestone.xp - prevMilestoneXp)) * 100);
  const xpToNext = Math.max(currentMilestone.xp - totalXp, 0);

  const animalColors: Record<string, { gradient: string; shadow: string; bg: string }> = {
    dragon: {
      gradient: 'radial-gradient(circle at 30% 30%, #a78bfa, #7c3aed, #5b21b6)',
      shadow: '0 12px 40px rgba(124, 58, 237, 0.3)',
      bg: 'bg-violet-50',
    },
    cat: {
      gradient: 'radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b, #d97706)',
      shadow: '0 12px 40px rgba(245, 158, 11, 0.3)',
      bg: 'bg-amber-50',
    },
    dog: {
      gradient: 'radial-gradient(circle at 30% 30%, #60a5fa, #3b82f6, #2563eb)',
      shadow: '0 12px 40px rgba(59, 130, 246, 0.3)',
      bg: 'bg-blue-50',
    },
    bear: {
      gradient: 'radial-gradient(circle at 30% 30%, #a78bfa, #8b5cf6, #7c3aed)',
      shadow: '0 12px 40px rgba(139, 92, 246, 0.3)',
      bg: 'bg-purple-50',
    },
    rabbit: {
      gradient: 'radial-gradient(circle at 30% 30%, #fb7185, #f43f5e, #e11d48)',
      shadow: '0 12px 40px rgba(244, 63, 94, 0.3)',
      bg: 'bg-rose-50',
    },
  };

  const colors = animalColors[character.animalType] || animalColors.dragon;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 상단 헤더 */}
      <div className="bg-white px-4 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{character.name}</h1>
          <p className="text-xs text-gray-400">
            {ANIMAL_EMOJI[character.animalType] || '🐾'} {ANIMAL_NAMES[character.animalType] || character.animalType} · Lv. {level}
          </p>
        </div>
        <LogoutButton className="text-xs text-gray-400 hover:text-red-400" />
      </div>

      {/* 캐릭터 아바타 */}
      <div className={`flex justify-center py-8 ${colors.bg}`}>
        <div className="relative">
          <div
            className="w-40 h-40 rounded-full"
            style={{
              background: colors.gradient,
              boxShadow: colors.shadow,
            }}
          />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white text-gray-700 px-4 py-1 rounded-full text-sm font-bold shadow-md border border-gray-100">
            Lv. {level}
          </div>
        </div>
      </div>

      {/* 레벨 진행 바 */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>다음 레벨까지</span>
          <span>{xpInLevel} / 1000 XP</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-orange-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${(xpInLevel / 1000) * 100}%` }}
          />
        </div>
      </div>

      {/* 시즌 프로필 카드 */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700">시즌 성적</p>
          </div>
          <div className="flex">
            <div className="flex-1 p-4 text-center border-r border-gray-100">
              <p className="text-gray-400 text-[10px] mb-1">타율</p>
              <p className="text-2xl font-bold text-gray-900">{seasonAvg}</p>
            </div>
            <div className="flex-1 p-4 text-center border-r border-gray-100">
              <p className="text-gray-400 text-[10px] mb-1">총 XP</p>
              <p className="text-2xl font-bold text-orange-500">{totalXp}</p>
            </div>
            <div className="flex-1 p-4 text-center">
              <p className="text-gray-400 text-[10px] mb-1">적중률</p>
              <p className="text-2xl font-bold text-emerald-500">{accuracy}%</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-gray-50 text-center">
            <p className="text-xs text-gray-400">
              {settled.length}경기 참여 · 승리 예측 {correctCount}회 적중
            </p>
          </div>
        </div>
      </div>

      {/* 마일스톤 */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-700">다음 마일스톤</p>
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              {currentMilestone.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1">
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-400 to-orange-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${milestoneProgress}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
              {milestoneProgress}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400">
              {xpToNext > 0 ? `${xpToNext} XP 남음` : '달성!'}
            </p>
            <p className="text-xs text-gray-400">
              보상: {currentMilestone.reward}
            </p>
          </div>
        </div>
      </div>

      {/* 최근 결과 */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">최근 경기</p>
          {recentSettled ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-900 font-medium">
                  {recentSettled.game
                    ? `${recentSettled.game.awayTeam} vs ${recentSettled.game.homeTeam}`
                    : recentSettled.date}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {recentSettled.date} · {recentSettled.team} {recentSettled.battingOrder}번 타자
                  {recentSettled.isCorrect !== undefined && (
                    <span className={recentSettled.isCorrect ? 'text-emerald-500 ml-1' : 'text-red-400 ml-1'}>
                      {recentSettled.isCorrect ? '· 예측 적중!' : '· 예측 실패'}
                    </span>
                  )}
                </p>
              </div>
              <span className={`text-lg font-bold ${recentXp !== null && recentXp >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {recentXp !== null ? `${recentXp >= 0 ? '+' : ''}${recentXp}` : '-'} XP
              </span>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-2">아직 경기 기록이 없습니다</p>
              <button
                onClick={() => router.push('/match')}
                className="text-sm text-orange-500 font-medium"
              >
                첫 배치하러 가기 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
