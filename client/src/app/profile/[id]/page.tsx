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

interface TodayGame {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  startTime?: string;
}

interface TodayPlacement {
  team: string;
  battingOrder: number;
  predictedWinner: string;
  status: string;
  isCorrect?: boolean;
  xpFromPlayer?: number;
  xpFromPrediction?: number;
  game: TodayGame | null;
}

interface PublicProfile {
  character: {
    _id: string;
    name: string;
    animalType: string;
    xp: number;
    activeTrait: string | null;
    totalPlacements: number;
    streak: number;
    createdAt: string;
  };
  todayPlacement: TodayPlacement | null;
}

function getCharacterSize(xp: number): number {
  const minPx = 60;
  if (xp <= 0) return minPx;
  const size = minPx + Math.pow(xp, 0.55) * 7.5;
  return Math.max(minPx, Math.round(size));
}

// KBO 팀 이모지 매핑
const TEAM_EMOJI: Record<string, string> = {
  '삼성 라이온즈': '🦁', '기아 타이거즈': '🐯', 'LG 트윈스': '🤞',
  '두산 베어스': '🐻', 'KT 위즈': '🧙', 'SSG 랜더스': '🛬',
  '롯데 자이언츠': '🦅', '한화 이글스': '🦅', 'NC 다이노스': '🦕',
  '키움 히어로즈': '🦸',
};

function getTeamShort(name: string): string {
  if (!name) return '?';
  return name.split(' ')[0];
}

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
      const res = await fetch(`${apiUrl}/api/characters/${characterId}/public`, {
        cache: 'no-store',
      });
      if (res.ok) {
        setProfile(await res.json());
      } else {
        console.error('프로필 로드 실패:', res.status);
        setError(true);
      }
    } catch (e) {
      console.error('프로필 fetch 에러:', e);
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
          onClick={() => router.back()}
          className="px-4 py-2 bg-orange-400 text-white rounded-xl text-sm font-bold"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const { character, todayPlacement } = profile;
  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const characterSize = getCharacterSize(character.xp);
  const isPixelArt = PIXEL_ART_ANIMALS.includes(character.animalType);

  // 배치 상태 표시
  function getStatusBadge(status: string, isCorrect?: boolean) {
    if (status === 'settled') {
      return isCorrect
        ? { text: '적중!', color: 'bg-emerald-100 text-emerald-600' }
        : { text: '정산완료', color: 'bg-gray-100 text-gray-500' };
    }
    if (status === 'active') return { text: '경기 진행중', color: 'bg-amber-100 text-amber-600' };
    return { text: '대기중', color: 'bg-blue-100 text-blue-500' };
  }

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
        <span className="text-xs text-gray-300">프로필</span>
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
        {/* 스트릭 */}
        {character.streak > 0 && (
          <p className="text-xs text-orange-400 mt-2 font-medium">
            🔥 {character.streak}일 연속 배치중
          </p>
        )}
      </div>

      {/* ★ 오늘의 배치 카드 */}
      <div className="px-4 mt-4">
        {todayPlacement && todayPlacement.game ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-700">오늘의 배치</h2>
              {(() => {
                const badge = getStatusBadge(todayPlacement.status, todayPlacement.isCorrect);
                return (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                    {badge.text}
                  </span>
                );
              })()}
            </div>

            {/* 경기 스코어 */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl mb-1">{TEAM_EMOJI[todayPlacement.game.awayTeam] || '⚾'}</p>
                <p className="text-xs font-bold text-gray-700">{getTeamShort(todayPlacement.game.awayTeam)}</p>
                {todayPlacement.game.status === 'finished' && (
                  <p className="text-lg font-bold text-gray-800 mt-1">{todayPlacement.game.awayScore ?? '-'}</p>
                )}
              </div>

              <div className="text-center px-3">
                <p className="text-xs text-gray-400 font-medium">VS</p>
                {todayPlacement.game.startTime && todayPlacement.game.status === 'scheduled' && (
                  <p className="text-[10px] text-gray-300 mt-1">{todayPlacement.game.startTime}</p>
                )}
              </div>

              <div className="text-center">
                <p className="text-2xl mb-1">{TEAM_EMOJI[todayPlacement.game.homeTeam] || '⚾'}</p>
                <p className="text-xs font-bold text-gray-700">{getTeamShort(todayPlacement.game.homeTeam)}</p>
                {todayPlacement.game.status === 'finished' && (
                  <p className="text-lg font-bold text-gray-800 mt-1">{todayPlacement.game.homeScore ?? '-'}</p>
                )}
              </div>
            </div>

            {/* 배치 정보 */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">배치 팀</span>
                <span className="text-xs font-bold text-gray-700">
                  {todayPlacement.team === 'home'
                    ? todayPlacement.game.homeTeam
                    : todayPlacement.team === 'away'
                    ? todayPlacement.game.awayTeam
                    : todayPlacement.team}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">타순</span>
                <span className="text-xs font-bold text-gray-700">{todayPlacement.battingOrder}번</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">승리 예측</span>
                <span className="text-xs font-bold text-gray-700">
                  {todayPlacement.predictedWinner}
                  {todayPlacement.status === 'settled' && (
                    <span className={`ml-1 ${todayPlacement.isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>
                      {todayPlacement.isCorrect ? '✓' : '✗'}
                    </span>
                  )}
                </span>
              </div>

              {/* 정산 완료시 XP */}
              {todayPlacement.status === 'settled' && (
                <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                  <span className="text-xs text-gray-400">획득 XP</span>
                  <span className="text-xs font-bold text-orange-500">
                    +{(todayPlacement.xpFromPlayer ?? 0) + (todayPlacement.xpFromPrediction ?? 0)} XP
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 오늘 배치 없음 */
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl mb-3">😴</p>
            <p className="text-sm text-gray-400">오늘은 아직 배치하지 않았어요</p>
          </div>
        )}
      </div>

      {/* 하단 여백 (추후 방명록/좋아요/밥주기 영역) */}
      <div className="px-4 mt-6">
        <div className="bg-gray-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-300">🚧 곧 방명록, 좋아요, 밥주기 기능이 추가됩니다</p>
        </div>
      </div>
    </div>
  );
}
