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

  const xp = character?.xp ?? 0;
  const charSize = 200 + xp * 0.05;

  const animalEmoji: Record<string, string> = {
    bear: '🐻', tiger: '🐯', eagle: '🦅', wolf: '🐺', dragon: '🐲',
  };
  const animalName: Record<string, string> = {
    bear: '곰', tiger: '호랑이', eagle: '독수리', wolf: '늑대', dragon: '용',
  };
  const emoji = animalEmoji[character?.animalType] || '🐾';

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-700 text-lg">캐릭터를 만들어주세요!</p>
        <button
          onClick={() => router.push('/character')}
          className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
        >
          캐릭터 만들기
        </button>
      </div>
    );
  }

  // 비교 화면
  if (showCompare) {
    const screenH = typeof window !== 'undefined' ? window.innerHeight * 0.7 : 500;
    const scale = charSize > screenH ? screenH / charSize : 1;
    const currentDisplay = charSize * scale;
    const initialDisplay = 200 * scale;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-8 px-4">
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-gradient-to-br from-orange-200 to-orange-400 rounded-full flex items-center justify-center shadow-md"
              style={{ width: `${initialDisplay}px`, height: `${initialDisplay}px` }}
            >
              <span style={{ fontSize: `${initialDisplay * 0.5}px` }}>{emoji}</span>
            </div>
            <span className="text-gray-400 text-xs">처음</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-gradient-to-br from-orange-300 to-orange-500 rounded-full flex items-center justify-center shadow-lg"
              style={{ width: `${currentDisplay}px`, height: `${currentDisplay}px` }}
            >
              <span style={{ fontSize: `${currentDisplay * 0.5}px` }}>{emoji}</span>
            </div>
            <span className="text-gray-700 text-xs font-medium">지금 (XP: {xp})</span>
          </div>
        </div>
        <div className="p-4">
          <button onClick={() => setShowCompare(false)} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 기록 화면
  if (showHistory) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-gray-900 text-lg font-bold mb-4">배치 기록</h2>
          {history.length === 0 ? (
            <p className="text-gray-400">아직 기록이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {history.map((log: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-xs">{log.date}</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      log.status === 'settled' ? 'bg-emerald-50 text-emerald-500' : 'bg-orange-50 text-orange-500'
                    }`}>
                      {log.status === 'settled' ? '정산완료' : '대기중'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 text-sm font-medium">
                      {log.team} {log.battingOrder}번 타자
                    </span>
                    {log.status === 'settled' && (
                      <span className={`text-sm font-bold ${
                        (log.xpFromPlayer + log.xpFromPrediction) >= 0 ? 'text-emerald-500' : 'text-red-400'
                      }`}>
                        {(log.xpFromPlayer + log.xpFromPrediction) >= 0 ? '+' : ''}
                        {log.xpFromPlayer + log.xpFromPrediction} XP
                      </span>
                    )}
                  </div>
                  {log.predictedWinner && (
                    <span className="text-gray-400 text-xs">승리예측: {log.predictedWinner}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          <button onClick={() => setShowHistory(false)} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 메인 화면
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-6"
      >
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 flex flex-col items-center gap-5 w-full max-w-xs">
          <div
            className="bg-gradient-to-br from-orange-200 to-orange-400 rounded-full flex items-center justify-center shadow-md shadow-orange-200/50"
            style={{
              width: `${Math.min(charSize, 200)}px`,
              height: `${Math.min(charSize, 200)}px`,
            }}
          >
            <span style={{ fontSize: `${Math.min(charSize, 200) * 0.5}px` }}>{emoji}</span>
          </div>

          <p className="text-gray-900 font-bold text-xl">{character.name}</p>

          <div className="w-full">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-400">경험치</span>
              <button
                onClick={() => { fetchHistory(); setShowHistory(true); }}
                className="text-orange-500 font-bold hover:underline"
              >
                {xp} XP
              </button>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-400 to-orange-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min((xp % 1000) / 10, 100)}%` }}
              />
            </div>
          </div>

          <span className="text-gray-400 text-xs">{animalName[character.animalType]}</span>

          {placement && (
            <div className="w-full bg-orange-50 border border-orange-100 rounded-2xl p-3 text-center">
              <p className="text-orange-500 text-xs font-medium">오늘의 배치</p>
              <p className="text-gray-800 text-sm font-bold mt-1">{placement.team} {placement.battingOrder}번 타자</p>
              <p className="text-gray-400 text-xs mt-0.5">승리예측: {placement.predictedWinner}</p>
            </div>
          )}

          <button
            onClick={() => setShowCompare(true)}
            className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2.5 rounded-2xl text-sm font-medium transition border border-gray-200"
          >
            성장 비교
          </button>
        </div>
      </div>

      <button
        onClick={() => router.push('/match')}
        className="fixed bottom-20 right-4 bg-orange-400 hover:bg-orange-300 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-orange-300/40 text-xl z-40 transition"
        title={placement ? `${placement.team} ${placement.battingOrder}번` : '배치하기'}
      >
        {placement ? '✓' : '⚾'}
      </button>
    </div>
  );
}
