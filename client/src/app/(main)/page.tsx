'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

interface Character {
  _id: string;
  name: string;
  animal: 'dragon' | 'cat' | 'dog' | 'bear' | 'rabbit';
  level: number;
  xp: number;
  userId: string;
}

export default function MainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (status === 'authenticated') {
      fetchCharacter();
    }
  }, [status, router]);

  const fetchCharacter = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/characters/me`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          router.push('/character');
          return;
        }
        throw new Error('Failed to fetch character');
      }

      const data = await res.json();
      setCharacter(data);
    } catch (error) {
      console.error('Error fetching character:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  // XP 진행도 계산 (레벨당 1000 XP 가정)
  const xpForNextLevel = 1000;
  const xpProgress = (character.xp / xpForNextLevel) * 100;

  // 동물별 색상
  const animalColors: Record<string, { gradient: string; shadow: string }> = {
    dragon: {
      gradient: 'radial-gradient(circle at 30% 30%, #a78bfa, #7c3aed, #5b21b6)',
      shadow: '0 20px 60px rgba(124, 58, 237, 0.4)',
    },
    cat: {
      gradient: 'radial-gradient(circle at 30% 30%, #fbbf24, #f59e0b, #d97706)',
      shadow: '0 20px 60px rgba(245, 158, 11, 0.4)',
    },
    dog: {
      gradient: 'radial-gradient(circle at 30% 30%, #60a5fa, #3b82f6, #2563eb)',
      shadow: '0 20px 60px rgba(59, 130, 246, 0.4)',
    },
    bear: {
      gradient: 'radial-gradient(circle at 30% 30%, #a78bfa, #8b5cf6, #7c3aed)',
      shadow: '0 20px 60px rgba(139, 92, 246, 0.4)',
    },
    rabbit: {
      gradient: 'radial-gradient(circle at 30% 30%, #fb7185, #f43f5e, #e11d48)',
      shadow: '0 20px 60px rgba(244, 63, 94, 0.4)',
    },
  };

  const currentAnimal = animalColors[character.animal] || animalColors.dragon;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative">
      {/* 로그아웃 버튼 배치 */}
      <div className="absolute top-6 right-6">
        <LogoutButton />
      </div>

      {/* 캐릭터 이름 */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{character.name}</h1>
      <p className="text-gray-600 mb-8">Lv. {character.level}</p>

      {/* 3D 구체 캐릭터 */}
      <div className="relative w-80 h-80 mb-8">
        <div
          className="w-full h-full rounded-full"
          style={{
            background: currentAnimal.gradient,
            boxShadow: currentAnimal.shadow,
            transform: 'translateZ(0)',
          }}
        />
      </div>

      {/* XP 진행 바 */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>XP</span>
          <span>
            {character.xp} / {xpForNextLevel}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-orange-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
      </div>

      {/* FAB 메뉴 버튼 */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* 메뉴 아이템들 */}
        <div
          className={`flex flex-col gap-3 mb-3 transition-all duration-300 ${
            menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <Link
            href="/placements/history"
            className="bg-white text-gray-700 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <span>📋</span>
            <span className="text-sm font-medium">배치 기록</span>
          </Link>

          <Link
            href="/placements/today"
            className="bg-white text-gray-700 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <span>⚾</span>
            <span className="text-sm font-medium">오늘의 배치</span>
          </Link>

          <Link
            href="/rankings"
            className="bg-white text-gray-700 px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <span>📊</span>
            <span className="text-sm font-medium">성장 비교</span>
          </Link>
        </div>

        {/* 메인 FAB 버튼 */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`w-14 h-14 bg-orange-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center ${
            menuOpen ? 'rotate-45' : 'rotate-0'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
