'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [placement, setPlacement] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [screen, setScreen] = useState<'main' | 'history' | 'compare' | 'placement'>('main');

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
      if (res.ok) setPlacement(await res.json());
    } catch (e) { console.error(e); }
  }

  const xp = character?.xp ?? 0;
  // XP에 따라 구체 크기 (최소 140px, 최대 280px)
  const sphereSize = Math.min(140 + xp * 0.14, 280);

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

  // 성장 비교 화면
  if (screen === 'compare') {
    const initSize = 140;
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-10 px-4">
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: `${initSize}px`,
                height: `${initSize}px`,
                background: 'radial-gradient(circle at 35% 35%, #fdba74, #ea580c, #9a3412)',
                boxShadow: '0 8px 30px rgba(234, 88, 12, 0.25), inset 0 -4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <span style={{ fontSize: `${initSize * 0.45}px` }}>{emoji}</span>
            </div>
            <span className="text-gray-400 text-xs">처음</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: `${sphereSize}px`,
                height: `${sphereSize}px`,
                background: 'radial-gradient(circle at 35% 35%, #fdba74, #ea580c, #9a3412)',
                boxShadow: '0 12px 40px rgba(234, 88, 12, 0.3), inset 0 -6px 16px rgba(0,0,0,0.15)',
              }}
            >
              <span style={{ fontSize: `${sphereSize * 0.45}px` }}>{emoji}</span>
            </div>
            <span className="text-gray-700 text-xs font-medium">지금 (XP: {xp})</span>
          </div>
        </div>
        <div className="p-4">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 배치 기록 화면
  if (screen === 'history') {
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
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 오늘의 배치 화면
  if (screen === 'placement') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          {placement ? (
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 w-full max-w-xs text-center space-y-4">
              <p className="text-orange-500 text-sm font-bold">오늘의 배치</p>
              <p className="text-gray-900 text-2xl font-bold">{placement.team}</p>
              <p className="text-gray-600 text-lg">{placement.battingOrder}번 타자</p>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs">승리 예측</p>
                <p className="text-orange-500 font-bold">{placement.predictedWinner}</p>
              </div>
              <button
                onClick={() => router.push('/match')}
                className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold shadow-md"
              >
                배치 변경하기
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-gray-400">오늘 배치가 없습니다</p>
              <button
                onClick={() => router.push('/match')}
                className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
              >
                배치하러 가기
              </button>
            </div>
          )}
        </div>
        <div className="p-4">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 메인 화면: 3D 구체 +

`client/src/app/(main)/page.tsx` 전체를 아래로 교체하세요:

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [placement, setPlacement] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [screen, setScreen] = useState<'main' | 'history' | 'compare' | 'placement'>('main');

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
      if (res.ok) setPlacement(await res.json());
    } catch (e) { console.error(e); }
  }

  const xp = character?.xp ?? 0;
  // 3D 구체 크기: 최소 150, XP에 따라 커짐, 최대 280
  const sphereSize = Math.min(150 + xp * 0.1, 280);

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

  // 성장 비교 화면
  if (screen === 'compare') {
    const initSize = 120;
    const curSize = Math.min(120 + xp * 0.08, 220);
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-10 px-4">
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: `${initSize}px`,
                height: `${initSize}px`,
                background: 'radial-gradient(circle at 35% 35%, #fdba74, #f97316, #c2410c)',
                boxShadow: '0 8px 30px rgba(249,115,22,0.25), inset 0 -4px 12px rgba(0,0,0,0.15), inset 0 4px 8px rgba(255,255,255,0.3)',
              }}
            >
              <span style={{ fontSize: `${initSize * 0.45}px` }}>{emoji}</span>
            </div>
            <span className="text-gray-400 text-xs">처음</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: `${curSize}px`,
                height: `${curSize}px`,
                background: 'radial-gradient(circle at 35% 35%, #fdba74, #f97316, #c2410c)',
                boxShadow: '0 12px 40px rgba(249,115,22,0.35), inset 0 -6px 16px rgba(0,0,0,0.2), inset 0 6px 12px rgba(255,255,255,0.3)',
              }}
            >
              <span style={{ fontSize: `${curSize * 0.45}px` }}>{emoji}</span>
            </div>
            <span className="text-gray-600 text-xs font-medium">지금 (XP: {xp})</span>
          </div>
        </div>
        <div className="p-4 pb-20">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 배치 기록 화면
  if (screen === 'history') {
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
                    <span className="text-gray-800 text-sm font-medium">{log.team} {log.battingOrder}번 타자</span>
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
        <div className="p-4 pb-20">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 오늘의 배치 화면
  if (screen === 'placement') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          {placement ? (
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 w-full max-w-xs text-center space-y-4">
              <p className="text-orange-500 text-sm font-bold">오늘의 배치</p>
              <p className="text-gray-900 text-2xl font-bold">{placement.team}</p>
              <p className="text-gray-600 text-lg">{placement.battingOrder}번 타자</p>
              <div className="bg-orange-50 rounded-2xl p-3">
                <p className="text-gray-400 text-xs">승리 예측</p>
                <p className="text-orange-500 font-bold">{placement.predictedWinner}</p>
              </div>
              <button
                onClick={() => router.push('/match')}
                className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold shadow-md"
              >
                배치 변경하기
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-gray-400">오늘 배치가 없습니다</p>
              <button
                onClick={() => router.push('/match')}
                className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
              >
                배치하러 가기
              </button>
            </div>
          )}
        </div>
        <div className="p-4 pb-20">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 메인 화면: 3D 구체 캐릭터
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* 3D 공간 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* 바닥 그림자 */}
        <div
          className="rounded-full bg-black/10 blur-xl"
          style={{
            width: `${sphereSize * 0.8}px`,
            height: `${sphereSize * 0.15}px`,
            marginBottom: '-20px',
            zIndex: 0,
          }}
        />

        {/* 3D 구체 */}
        <div
          className="rounded-full flex items-center justify-center relative animate-bounce"
          style={{
            width: `${sphereSize}px`,
            height: `${sphereSize}px`,
            background: 'radial-gradient(circle at 35% 35%, #fdba74, #f97316, #c2410c)',
            boxShadow: `
              0 ${sphereSize * 0.08}px ${sphereSize * 0.2}px rgba(249,115,22,0.3),
              inset 0 -${sphereSize * 0.04}px ${sphereSize * 0.1}px rgba(0,0,0,0.2),
              inset 0 ${sphereSize * 0.04}px ${sphereSize * 0.08}px rgba(255,255,255,0.3)
            `,
            animationDuration: '3s',
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: `${sphereSize * 0.45}px` }}>{emoji}</span>

          {/* 하이라이트 */}
          <div
            className="absolute rounded-full bg-white/30 blur-sm"
            style={{
              width: `${sphereSize * 0.25}px`,
              height: `${sphereSize * 0.15}px`,
              top: `${sphereSize * 0.12}px`,
              left: `${sphereSize * 0.2}px`,
            }}
          />
        </div>

        {/* 캐릭터 이름 */}
        <p className="text-gray-900 font-bold text-xl mt-6">{character.name}</p>
        <p className="text-gray-400 text-xs mt-1">{animalName[character.animalType]}</p>
      </div>

      {/* 오른쪽 하단 메뉴 버튼 */}
      {menuOpen && (
        <div className="fixed bottom-36 right-4 z-50 flex flex-col gap-2 items-end">
          <button
            onClick={() => { setMenuOpen(false); fetchHistory(); setScreen('history'); }}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg flex items-center gap-2"
          >
            <span className="text-orange-500 font-bold">{xp} XP</span>
            <span>배치 기록</span>
          </button>
          <button
            onClick={() => { setMenuOpen(false); setScreen('placement'); }}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg flex items-center gap-2"
          >
            {placement ? (
              <span>{placement.team} {placement.battingOrder}번</span>
            ) : (
              <span>오늘의 배치</span>
            )}
          </button>
          <button
            onClick={() => { setMenuOpen(false); setScreen('compare'); }}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg"
          >
            성장 비교
          </button>
        </div>
      )}

      {/* FAB 버튼 */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={`fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-xl z-50 transition-all duration-300 ${
          menuOpen
            ? 'bg-gray-700 text-white rotate-45'
            : 'bg-orange-400 text-white shadow-orange-300/40'
        }`}
      >
        {menuOpen ? '+' : '☰'}
      </button>
    </div>
  );
}
