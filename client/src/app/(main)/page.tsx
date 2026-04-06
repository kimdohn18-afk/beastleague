'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/characters/me`, {
        headers: { Authorization: `Bearer ${token}` },
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
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">캐릭터를 불러올 수 없습니다</p>
        <LogoutButton />
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* 로그아웃 - 오른쪽 상단 */}
      <div className="absolute top-6 right-6">
        <LogoutButton className="text-xs text-gray-400 hover:text-red-400" />
      </div>

      {/* 캐릭터 이름 + 레벨 */}
      <h1 className="text-3xl font-bold text-gray-900 mb-1">{character.name}</h1>
      <p className="text-gray-400 text-sm mb-8">Lv. {character.level} · XP {character.xp}</p>

      {/* 3D 구체 캐릭터 */}
      <div className="relative w-72 h-72 mb-8">
        <div
          className="w-full h-full rounded-full"
          style={{
            background: currentAnimal.gradient,
            boxShadow: currentAnimal.shadow,
            transform: 'translateZ(0)',
          }}
        />
      </div>
    </div>
  );
}
