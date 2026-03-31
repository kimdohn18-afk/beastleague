'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ANIMALS = [
  { type: 'bear', emoji: '🐻', name: '곰' },
  { type: 'tiger', emoji: '🐯', name: '호랑이' },
  { type: 'eagle', emoji: '🦅', name: '독수리' },
  { type: 'wolf', emoji: '🐺', name: '늑대' },
  { type: 'dragon', emoji: '🐲', name: '용' },
];

export default function CharacterCreatePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function handleCreate() {
    if (!selected || !name.trim()) {
      setError('이름과 캐릭터를 선택해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/characters`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: name.trim(), animalType: selected }),
      });
      if (res.ok) {
        router.push('/');
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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="text-white text-xl font-bold">캐릭터 만들기</h1>

      <input
        type="text"
        placeholder="캐릭터 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={10}
        className="w-full max-w-xs bg-gray-900 text-white px-4 py-3 rounded-lg text-center outline-none focus:ring-1 focus:ring-yellow-400"
      />

      <div className="grid grid-cols-5 gap-3">
        {ANIMALS.map((a) => (
          <button
            key={a.type}
            onClick={() => setSelected(a.type)}
            className={`flex flex-col items-center p-3 rounded-xl transition ${
              selected === a.type
                ? 'bg-yellow-400 scale-110'
                : 'bg-gray-900'
            }`}
          >
            <span className="text-3xl">{a.emoji}</span>
            <span className={`text-xs mt-1 ${
              selected === a.type ? 'text-black' : 'text-gray-500'
            }`}>{a.name}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={submitting || !selected || !name.trim()}
        className="w-full max-w-xs bg-yellow-400 text-black py-3 rounded-lg font-bold disabled:opacity-40"
      >
        {submitting ? '만드는 중...' : '시작하기'}
      </button>
    </div>
  );
}
