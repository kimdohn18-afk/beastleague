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
  const [placement, setPlacement] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchCharacter();
    fetchTodayPlacement();
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
      const res = await fetch(`${apiUrl}/api/placements/history`, { headers });
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error(e); }
  }

  async function fetchTodayPlacement() {
    try {
      const res = await fetch(`${apiUrl}/api/placements/today`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPlacement(data);
      }
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

  // 동물 이모지
  const animalEmoji: Record<string, string> = {
    bear: '🐻', tiger: '🐯', eagle: '🦅', wolf: '🐺', dragon: '🐲',
  };
  const emoji = animalEmoji[character.animalType] || '🐾';

  // 비교 모드
  if (showCompare) {
    const screenH = typeof window !== 'undefined' ? window.innerHeight * 0.7 : 500;
    const scale = charSize > screenH ? screenH / charSize : 1;
    const currentDisplay = charSize * scale;
    const initialDisplay = 200 * scale;

    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-8 px-4">
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-yellow-400 rounded-sm flex items-center justify-center"
              style={{ width: `${initialDisplay}px`, height: `${initialDisplay}px` }}
            >
              <span style={{ fontSize: `${initialDisplay * 0.5}px` }}>{emoji}</span>
            </div>
            <span className="text-gray-500 text-xs">처음</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-yellow-400 rounded-sm flex items-center justify-center"
              style={{ width: `${currentDisplay}px`, height: `${currentDisplay}px` }}
            >
              <span style={{ fontSize: `${currentDisplay * 0.5}px` }}>{emoji}</span>
            </div>
            <span className="text-white text-xs">지금 (XP: {xp})</span>
          </div>
        </div>
        <div className="p-4">
          <button onClick={() => setShowCompare(false)} className="w-full bg-gray-800 text-white py-3 rounded-lg">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 기록 (배치 히스토리)
  if (showHistory) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-white text-lg font-bold mb-4">배치 기록</h2>
          {history.length === 0 ? (
            <p className="text-gray-500">아직 기록이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {history.map((log: any, i: number) => (
                <div key={i} className="bg-gray-900 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 text-xs">{log.date}</span>
                    <span className={`text-xs font-bold ${
                      log.status === 'settled' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {log.status === 'settled' ? '정산완료' : '대기중'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm">
                      {log.team} {log.battingOrder}번 타자
                    </span>
                    {log.status === 'settled' && (
                      <span className={`text-sm font-bold ${
                        (log.xpFromPlayer + log.xpFromPrediction) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {(log.xpFromPlayer + log.xpFromPrediction) >= 0 ? '+' : ''}
                        {log.xpFromPlayer + log.xpFromPrediction} XP
                      </span>
                    )}
                  </div>
                  {log.predictedWinner && (
                    <span className="text-gray-500 text-xs">승리예측: {log.predictedWinner}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          <button onClick={() => setShowHistory(false)} className="w-full bg-gray-800 text-white py-3 rounded-lg">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 메인: 캐릭터 표시
  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      {/* 캐릭터 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex flex-col items-center justify-center"
      >
        <div
          className="bg-yellow-400 rounded-sm flex items-center justify-center"
          style={{
            width: `${charSize}px`,
            height: `${charSize}px`,
            minWidth: `${charSize}px`,
            minHeight: `${charSize}px`,
            imageRendering: 'pixelated',
          }}
        >
          <span style={{ fontSize: `${charSize * 0.5}px` }}>{emoji}</span>
        </div>

        {/* 캐릭터 이름 + XP */}
        <p className="text-white font-bold text-lg mt-3">{character.name}</p>
        <button
          onClick={() => { fetchHistory(); setShowHistory(true); }}
          className="text-yellow-400 text-sm font-bold mt-1 hover:underline"
        >
          XP: {xp}
        </button>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3 p-4 pb-20">
        <button
          onClick={() => setShowCompare(true)}
          className="flex-1 bg-gray-800 text-white py-3 rounded-lg text-sm font-medium"
        >
          비교
        </button>
      </div>

      {/* 오늘 배치 확인 버튼 - 오른쪽 하단 */}
      <button
        onClick={() => router.push('/match')}
        className="fixed bottom-20 right-4 bg-yellow-400 text-black w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-lg z-40"
        title={placement ? `${placement.team} ${placement.battingOrder}번` : '배치하기'}
      >
        {placement ? '✓' : '⚾'}
      </button>
    </div>
  );
}
