'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ANIMALS = [
  { type: 'turtle',   emoji: '🐢', name: '거북이' },
  { type: 'eagle',    emoji: '🦅', name: '독수리' },
  { type: 'lion',     emoji: '🦁', name: '사자' },
  { type: 'dinosaur', emoji: '🦖', name: '공룡' },
  { type: 'dog',      emoji: '🐶', name: '강아지' },
  { type: 'fox',      emoji: '🦊', name: '여우' },
  { type: 'penguin',  emoji: '🐧', name: '펭귄' },
  { type: 'shark',    emoji: '🦈', name: '상어' },
  { type: 'bear',     emoji: '🐻', name: '곰' },
  { type: 'tiger',    emoji: '🐯', name: '호랑이' },
  { type: 'seagull',  emoji: '🕊️', name: '갈매기' },
  { type: 'dragon',   emoji: '🐉', name: '드래곤' },
  { type: 'cat',      emoji: '🐱', name: '고양이' },
  { type: 'rabbit',   emoji: '🐰', name: '토끼' },
  { type: 'gorilla',  emoji: '🦍', name: '고릴라' },
  { type: 'elephant', emoji: '🐘', name: '코끼리' },
];

export default function CharacterCreatePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  const selectedAnimal = ANIMALS.find((a) => a.type === selected);

  async function handleCreate() {
    if (!selected || !name.trim()) {
      setError('이름과 캐릭터를 선택해주세요');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/api/characters`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), animalType: selected }),
      });
      if (res.ok) {
        router.push('/tutorial');
      } else {
        const data = await res.json();
        setError(data.error || '생성 실패');
      }
    } catch (e) {
      setError('서버 오류');
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 pb-24">
      <h1 className="text-gray-900 text-xl font-bold mb-2">캐릭터 만들기</h1>
      <p className="text-gray-400 text-sm mb-8">동물을 선택하고 이름을 지어주세요</p>

      {/* 선택된 동물 미리보기 */}
      <div className="mb-8 h-28 flex items-center justify-center">
        {selectedAnimal ? (
  <div className="text-center">
    <img
      src={`/characters/${selectedAnimal.type}1.png`}
      alt={selectedAnimal.name}
      className="mx-auto"
      style={{ width: '100px', height: '100px', objectFit: 'contain', imageRendering: 'pixelated' }}
    />
    <p className="text-sm text-gray-500 mt-2">{selectedAnimal.name}</p>
  </div>
) : (
          <div className="text-center">
            <div className="text-5xl leading-none opacity-30">🐾</div>
            <p className="text-xs text-gray-300 mt-2">동물을 선택하세요</p>
          </div>
        )}
      </div>

      {/* 이름 입력 */}
      <input
        type="text"
        placeholder="캐릭터 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={10}
        className="w-full max-w-xs bg-white text-gray-900 px-4 py-3 rounded-2xl text-center outline-none focus:ring-2 focus:ring-orange-400 border border-gray-200 shadow-sm mb-6"
      />

      {/* 동물 선택 그리드 (11종) */}
      <div className="grid grid-cols-4 gap-2.5 w-full max-w-xs mb-6">
        {ANIMALS.map((a) => (
          <button
            key={a.type}
            onClick={() => setSelected(a.type)}
            className={`flex flex-col items-center p-2.5 rounded-2xl transition-all ${
              selected === a.type
                ? 'bg-orange-400 scale-110 shadow-md'
                : 'bg-white border border-gray-200 shadow-sm'
            }`}
          >
            <img
  src={`/characters/${a.type}1.png`}
  alt={a.name}
  style={{ width: '32px', height: '32px', objectFit: 'contain', imageRendering: 'pixelated' }}
/>
<span
              className={`text-[10px] mt-1 ${
                selected === a.type ? 'text-white font-medium' : 'text-gray-500'
              }`}
            >
              {a.name}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={submitting || !selected || !name.trim()}
        className="w-full max-w-xs bg-orange-400 text-white py-3.5 rounded-2xl font-bold disabled:opacity-40 shadow-md transition active:scale-[0.98]"
      >
        {submitting ? '만드는 중...' : '시작하기'}
      </button>
    </div>
  );
}
