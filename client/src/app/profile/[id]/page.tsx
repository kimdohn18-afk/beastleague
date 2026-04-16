'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ANIMAL_EMOJI,
  ANIMAL_NAMES,
  PIXEL_ART_ANIMALS,
  getTraitDisplay,
} from '@/lib/constants';
import WalkingCharacter from '@/components/WalkingCharacter';

interface PublicProfile {
  character: {
    _id: string;
    name: string;
    animalType: string;
    xp: number;
    activeTrait: string | null;
    totalPlacements: number;
    createdAt: string;
  };
  achievements: {
    activeTrait: { id: string; emoji: string; name: string; description: string } | null;
    earnedCount: number;
    totalCount: number;
    topAchievements: Array<{ id: string; emoji: string; name: string }>;
    teamAchievements: Array<{
      teamId: string;
      teamName: string;
      teamEmoji: string;
      tier: string;
    }>;
  };
}

function getCharacterSize(xp: number): number {
  const minPx = 60;
  if (xp <= 0) return minPx;
  const size = minPx + Math.pow(xp, 0.55) * 7.5;
  return Math.max(minPx, Math.round(size));
}

const TIER_LABELS: Record<string, string> = {
  bronze: '🥉 동',
  silver: '🥈 은',
  gold: '🥇 금',
  diamond: '💎 다이아',
};

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const characterId = params.id as string;

  useEffect(() => {
    if (!characterId) return;
    fetchProfile();
  }, [characterId]);

  async function fetchProfile() {
    try {
      const res = await fetch(`${apiUrl}/api/characters/${characterId}/public`);
      if (res.ok) {
        setProfile(await res.json());
      } else {
        setError(true);
      }
    } catch (e) {
      console.error(e);
      setError(true);
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

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-gray-500 mb-4">캐릭터를 찾을 수 없습니다</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-orange-400 text-white rounded-xl text-sm font-bold"
        >
          홈으로
        </button>
      </div>
    );
  }

  const { character, achievements } = profile;
  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const characterSize = getCharacterSize(character.xp);
  const isPixelArt = PIXEL_ART_ANIMALS.includes(character.animalType);
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(character.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-2 flex items-center justify-between relative z-10">
        <button
          onClick={() => router.back()}
          className="text-gray-400 text-sm"
        >
          ← 돌아가기
        </button>
        <span className="text-xs text-gray-300">공개 프로필</span>
      </div>

      {/* 걸어다니는 캐릭터 */}
      <WalkingCharacter
        animalType={character.animalType}
        characterSize={characterSize}
        isPixelArt={isPixelArt}
        emoji={emoji}
      />

      {/* 캐릭터 정보 */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4 relative z-10">
        <h1 className="text-2xl font-bold text-gray-800">{character.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {animalName} · {character.xp.toLocaleString()} XP
        </p>
        {character.activeTrait && (
          <div className="mt-3 bg-white/80 backdrop-blur rounded-xl px-4 py-2 border border-orange-100 shadow-sm">
            <p className="text-sm text-gray-700 font-medium">
              {getTraitDisplay(character.activeTrait)}
            </p>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-gray-800">
                {character.totalPlacements || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">배치 횟수</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {achievements.earnedCount}
              </p>
              <p className="text-xs text-gray-400 mt-1">업적</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">
                {daysSinceCreation}일
              </p>
              <p className="text-xs text-gray-400 mt-1">함께한 날</p>
            </div>
          </div>
        </div>
      </div>

      {/* 업적 미리보기 */}
      {achievements.topAchievements.length > 0 && (
        <div className="px-4 mt-5">
          <h2 className="text-sm font-bold text-gray-600 mb-3">획득 업적</h2>
          <div className="flex flex-wrap gap-2">
            {achievements.topAchievements.map((ach) => (
              <div
                key={ach.id}
                className="bg-white rounded-xl px-3 py-2 border border-gray-100 shadow-sm flex items-center gap-1.5"
              >
                <span className="text-lg">{ach.emoji}</span>
                <span className="text-xs text-gray-700 font-medium">{ach.name}</span>
              </div>
            ))}
            {achievements.earnedCount > 6 && (
              <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center">
                <span className="text-xs text-gray-400">
                  +{achievements.earnedCount - 6}개 더
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 팀 충성도 */}
      {achievements.teamAchievements.length > 0 && (
        <div className="px-4 mt-5">
          <h2 className="text-sm font-bold text-gray-600 mb-3">팀 충성도</h2>
          <div className="flex flex-wrap gap-2">
            {achievements.teamAchievements.map((ta) => (
              <div
                key={ta.teamId}
                className="bg-white rounded-xl px-3 py-2 border border-gray-100 shadow-sm flex items-center gap-1.5"
              >
                <span className="text-lg">{ta.teamEmoji}</span>
                <span className="text-xs text-gray-700 font-medium">
                  {ta.teamName.split(' ')[0]}
                </span>
                <span className="text-[10px] text-gray-400">
                  {TIER_LABELS[ta.tier]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 나도 시작하기 CTA (비로그인 유저용) */}
      <div className="px-4 mt-8">
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 bg-orange-400 text-white rounded-2xl text-sm font-bold hover:bg-orange-500 shadow-sm"
        >
          나도 비스트리그 시작하기
        </button>
      </div>
    </div>
  );
}
