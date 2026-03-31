'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchCharacter();
  }, [token, status]);

  async function fetchCharacter() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/characters/me`, { headers });
      if (res.ok) setCharacter(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchHistory() {
    try {
      const res = await fetch(`${apiUrl}/api/characters/me/history?limit=20`, { headers });
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error(e); }
  }

  // XP → 픽셀 크기
  const xp = character?.xp ?? 0;
  const charSize = 200 + xp * 0.05;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-white text-lg">캐릭터를 만들어주세요!</p>
        <button
          onClick={() => router.push('/character')}
          className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
        >
          캐릭터 만들기
        </button>
      </div>
    );
  }

  // 비교 모드: 둘 다 화면에 맞추기
  if (showCompare) {
    const screenH = typeof window !== 'undefined' ? window.innerHeight * 0.7 : 500;
    const scale = charSize > screenH ? screenH / charSize : 1;
    const currentDisplay = charSize * scale;
    const initialDisplay = 200 * scale;

    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-8 px-4">
          {/* 초기 캐릭터 */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-yellow-400 rounded-sm"
              style={{
                width: `${initialDisplay}px`,
                height: `${initialDisplay}px`,
                imageRendering: 'pixelated',
              }}
            />
            <span className="text-gray-500 text-xs">처음</span>
          </div>
          {/* 현재 캐릭터 */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-yellow-400 rounded-sm"
              style={{
                width: `${currentDisplay}px`,
                height: `${currentDisplay}px`,
                imageRendering: 'pixelated',
              }}
            />
            <span className="text-white text-xs">지금 (XP: {xp})</span>
          </div>
        </div>
        <div className="p-4">
          <button
            onClick={() => setShowCompare(false)}
            className="w-full bg-gray-800 text-white py-3 rounded-lg"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 기록 바텀시트
  if (showHistory) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-white text-lg font-bold mb-4">XP 기록</h2>
          {history.length === 0 ? (
            <p className="text-gray-500">아직 기록이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {history.map((log: any, i: number) => (
                <div key={i} className="bg-gray-900 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">{log.source}</span>
                    <span className={`text-sm font-bold ${
                      (log.xpAfter - log.xpBefore) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {(log.xpAfter - log.xpBefore) >= 0 ? '+' : ''}{log.xpAfter - log.xpBefore} XP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          <button
            onClick={() => setShowHistory(false)}
            className="w-full bg-gray-800 text-white py-3 rounded-lg"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 메인: 캐릭터 표시
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* 캐릭터 영역 - 스크롤/드래그 가능 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center"
      >
        <div
          className="bg-yellow-400 rounded-sm"
          style={{
            width: `${charSize}px`,
            height: `${charSize}px`,
            minWidth: `${charSize}px`,
            minHeight: `${charSize}px`,
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3 p-4">
        <button
          onClick={() => { setShowCompare(true); }}
          className="flex-1 bg-gray-800 text-white py-3 rounded-lg text-sm font-medium"
        >
          비교
        </button>
        <button
          onClick={() => { fetchHistory(); setShowHistory(true); }}
          className="flex-1 bg-gray-800 text-white py-3 rounded-lg text-sm font-medium"
        >
          기록
        </button>
      </div>
    </div>
  );
}
