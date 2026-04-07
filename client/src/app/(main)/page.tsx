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

const MILESTONES = [
  { xp: 500, label: '루키', reward: '기본 테두리' },
  { xp: 1500, label: '레귤러', reward: '실버 테두리' },
  { xp: 3000, label: '올스타', reward: '골드 테두리' },
  { xp: 5000, label: 'MVP', reward: '특별 이펙트' },
  { xp: 10000, label: '전설', reward: '레전드 칭호' },
];

const ANIMAL_EMOJI: Record<string, string> = {
  dragon: '🐉',
  cat: '🐱',
  dog: '🐶',
  bear: '🐻',
  rabbit: '🐰',
};

const ANIMAL_NAMES: Record<string, string> = {
  dragon: '드래곤',
  cat: '고양이',
  dog: '강아지',
  bear: '곰',
  rabbit: '토끼',
};

const ANIMAL_BG: Record<string, string> = {
  dragon: 'from-violet-100 to-purple-50',
  cat: 'from-amber-100 to-yellow-50',
  dog: 'from-blue-100 to-sky-50',
  bear: 'from-purple-100 to-fuchsia-50',
  rabbit: 'from-rose-100 to-pink-50',
};

function getLevel(xp: number): number {
  return Math.floor(xp / 1000) + 1;
}

// 레벨에 따라 이모지 크기가 커짐 (text 크기)
function getEmojiSize(level: number): string {
  if (level <= 1) return 'text-[80px]';
  if (level <= 2) return 'text-[100px]';
  if (level <= 3) return 'text-[120px]';
  if (level <= 5) return 'text-[140px]';
  if (level <= 7) return 'text-[160px]';
  if (level <= 10) return 'text-[180px]';
  return 'text-[200px]';
}

export default function MainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInfo, setShowInfo] = useState<'milestone' | 'compare' | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    if (status === 'authenticated' && token) {
      fetchCharacter();
    }
  }, [status, token]);

  const fetchCharacter = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/character');
          return;
        }
        throw new Error('Failed to fetch character');
      }
      setCharacter(await res.json());
    } catch (error) {
      console.error('Error fetching character:', error);
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
  const emojiSize = getEmojiSize(level);
  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const bgGradient = ANIMAL_BG[character.animalType] || 'from-gray-100 to-gray-50';

  // 마일스톤 계산
  const totalXp = character.xp;
  const currentMilestone =
    MILESTONES.find((m) => totalXp < m.xp) || MILESTONES[MILESTONES.length - 1];
  const milestoneIndex = MILESTONES.indexOf(currentMilestone);
  const prevXp = milestoneIndex > 0 ? MILESTONES[milestoneIndex - 1].xp : 0;
  const milestoneProgress =
    totalXp >= currentMilestone.xp
      ? 100
      : Math.round(((totalXp - prevXp) / (currentMilestone.xp - prevXp)) * 100);
  const xpToNext = Math.max(currentMilestone.xp - totalXp, 0);

  // 초기와 비교 (레벨 1, XP 0)
  const initialLevel = 1;

  return (
    <div className={`min-h-screen bg-gradient-to-b ${bgGradient} pb-24 relative`}>
      {/* 상단 헤더 */}
      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <div />
        <LogoutButton className="text-xs text-gray-400 hover:text-red-400" />
      </div>

      {/* 캐릭터 영역 - 화면 중앙 */}
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
        {/* 이모지 - 레벨에 따라 크기 변화 */}
        <div
          className={`${emojiSize} leading-none select-none transition-all duration-700 ease-out`}
          style={{
            filter: `drop-shadow(0 8px 24px rgba(0,0,0,0.1))`,
          }}
        >
          {emoji}
        </div>

        {/* 이름 + 레벨 */}
        <div className="mt-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">{character.name}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {animalName} · Lv. {level}
          </p>
        </div>

        {/* XP 미니 바 */}
        <div className="mt-4 w-40">
          <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-orange-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${(xpInLevel / 1000) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            {xpInLevel} / 1,000 XP
          </p>
        </div>
      </div>

      {/* FAB 버튼 */}
      <div className="fixed bottom-24 right-4 z-50">
        {/* 메뉴 아이템들 */}
        {menuOpen && (
          <div className="absolute bottom-16 right-0 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-2">
            <button
              onClick={() => {
                setShowInfo('milestone');
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              🎯 다음 레벨 / 마일스톤
            </button>
            <button
              onClick={() => {
                setShowInfo('compare');
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              📊 초기와 비교
            </button>
            <button
              onClick={() => {
                router.push('/my-placements');
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
            >
              📋 내 배치
            </button>
            <button
              onClick={() => {
                router.push('/match');
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
            >
              ⚾ 오늘의 경기
            </button>
          </div>
        )}

        {/* FAB 원형 버튼 */}
        <button
          onClick={() => {
            setMenuOpen(!menuOpen);
            setShowInfo(null);
          }}
          className={`w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center text-2xl transition-transform duration-300 hover:bg-orange-600 active:scale-95 ${
            menuOpen ? 'rotate-45' : ''
          }`}
        >
          +
        </button>
      </div>

      {/* 메뉴 바깥 클릭 시 닫기 */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 다음 레벨 / 마일스톤 모달 */}
      {showInfo === 'milestone' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowInfo(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">레벨 & 마일스톤</h2>

            {/* 다음 레벨 */}
            <div className="mb-5">
              <p className="text-sm text-gray-500 mb-1">다음 레벨까지</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-orange-400 h-full rounded-full transition-all"
                    style={{ width: `${(xpInLevel / 1000) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 font-medium">
                  {xpInLevel}/1000
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Lv. {level} → Lv. {level + 1} ({1000 - xpInLevel} XP 남음)
              </p>
            </div>

            {/* 마일스톤 목록 */}
            <div>
              <p className="text-sm text-gray-500 mb-2">마일스톤 진행</p>
              <div className="space-y-3">
                {MILESTONES.map((m) => {
                  const achieved = totalXp >= m.xp;
                  const isCurrent = m === currentMilestone && !achieved;
                  return (
                    <div key={m.xp} className="flex items-center gap-3">
                      <span className={`text-lg ${achieved ? '' : 'grayscale opacity-40'}`}>
                        {achieved ? '✅' : '🔒'}
                      </span>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${achieved ? 'text-gray-800' : 'text-gray-400'}`}>
                          {m.label}
                          <span className="text-xs text-gray-400 ml-1">({m.xp.toLocaleString()} XP)</span>
                        </p>
                        <p className="text-xs text-gray-400">{m.reward}</p>
                      </div>
                      {isCurrent && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                          {milestoneProgress}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowInfo(null)}
              className="w-full mt-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 초기와 비교 모달 */}
      {showInfo === 'compare' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowInfo(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">초기와 비교</h2>

            <div className="flex items-center justify-center gap-8 mb-6">
              {/* 초기 */}
              <div className="text-center">
                <div className="text-[40px] leading-none grayscale opacity-50 mb-2">{emoji}</div>
                <p className="text-xs text-gray-400">처음</p>
                <p className="text-sm font-bold text-gray-400">Lv. {initialLevel}</p>
                <p className="text-xs text-gray-400">0 XP</p>
              </div>

              {/* 화살표 */}
              <div className="text-2xl text-orange-400">→</div>

              {/* 현재 */}
              <div className="text-center">
                <div className={`${getEmojiSize(level)} leading-none mb-2`} style={{ fontSize: '60px' }}>{emoji}</div>
                <p className="text-xs text-orange-500 font-medium">현재</p>
                <p className="text-sm font-bold text-gray-800">Lv. {level}</p>
                <p className="text-xs text-orange-500">{totalXp.toLocaleString()} XP</p>
              </div>
            </div>

            {/* 성장 요약 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">레벨 상승</span>
                <span className="font-bold text-gray-800">+{level - initialLevel} 레벨</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">획득 XP</span>
                <span className="font-bold text-orange-500">+{totalXp.toLocaleString()} XP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">캐릭터 크기</span>
                <span className="font-bold text-gray-800">
                  {level <= 1
                    ? '기본'
                    : level <= 3
                    ? '약간 성장'
                    : level <= 5
                    ? '성장 중'
                    : level <= 7
                    ? '많이 성장'
                    : '최대 크기'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowInfo(null)}
              className="w-full mt-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
