'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/* ── 동물별 구체 색상 ── */
const SPHERE_THEME: Record<string, { gradient: string; shadow: string }> = {
  bear: {
    gradient: 'radial-gradient(circle at 35% 35%, #fde68a, #b45309, #78350f)',
    shadow: 'rgba(180,83,9,0.35)',
  },
  tiger: {
    gradient: 'radial-gradient(circle at 35% 35%, #fdba74, #f97316, #c2410c)',
    shadow: 'rgba(249,115,22,0.35)',
  },
  eagle: {
    gradient: 'radial-gradient(circle at 35% 35%, #bfdbfe, #3b82f6, #1e3a8a)',
    shadow: 'rgba(59,130,246,0.35)',
  },
  wolf: {
    gradient: 'radial-gradient(circle at 35% 35%, #e5e7eb, #6b7280, #1f2937)',
    shadow: 'rgba(107,114,128,0.35)',
  },
  dragon: {
    gradient: 'radial-gradient(circle at 35% 35%, #fca5a5, #dc2626, #7f1d1d)',
    shadow: 'rgba(220,38,38,0.35)',
  },
};
const DEFAULT_THEME = SPHERE_THEME.tiger;

const ANIMAL_EMOJI: Record<string, string> = {
  bear: '\u{1F43B}', tiger: '\u{1F42F}', eagle: '\u{1F985}', wolf: '\u{1F43A}', dragon: '\u{1F432}',
};
const ANIMAL_NAME: Record<string, string> = {
  bear: '곰', tiger: '호랑이', eagle: '독수리', wolf: '늑대', dragon: '용',
};

/* ── XP 항목 라벨 ── */
const XP_LABELS: Record<string, string> = {
  hits: '안타', rbi: '타점', runs: '득점',
  homeRun: '홈런', double: '2루타', triple: '3루타',
  stolenBase: '도루', caughtStealing: '도루자',
  walkOff: '결승타', teamResult: '팀 승패',
  noHitPenalty: '무안타',
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [placement, setPlacement] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [screen, setScreen] = useState<'main' | 'history' | 'compare' | 'placement' | 'settlement'>('main');

  /* ── 정산 팝업 ── */
  const [showSettlementPopup, setShowSettlementPopup] = useState(false);
  const [settlementData, setSettlementData] = useState<any>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchCharacter();
    fetchTodayPlacement();
    checkSettlement();
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

  async function checkSettlement() {
    try {
      const res = await fetch(`${apiUrl}/api/placements/history`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const settled = data.filter((p: any) => p.status === 'settled');
      if (settled.length === 0) return;

      const latest = settled[0];
      const seenKey = `settlement_seen_${latest._id}`;
      if (!localStorage.getItem(seenKey)) {
        setSettlementData(latest);
        setShowSettlementPopup(true);
        localStorage.setItem(seenKey, 'true');
      }
      setHistory(data);
    } catch (e) { console.error(e); }
  }

  /* ── 파생 값 ── */
  const xp = character?.xp ?? 0;
  const sphereSize = Math.min(150 + xp * 0.1, 280);
  const theme = SPHERE_THEME[character?.animalType] || DEFAULT_THEME;
  const emoji = ANIMAL_EMOJI[character?.animalType] || '\u{1F43E}';

  /* ── 정산 팝업 컴포넌트 ── */
  function renderSettlementPopup(data: any) {
    const totalXpItem = (data.xpFromPlayer || 0) + (data.xpFromPrediction || 0);
    const isPositive = totalXpItem >= 0;
    const breakdown = data.xpBreakdown;

    const breakdownItems = breakdown
      ? Object.entries(breakdown)
          .filter(([key, val]) => key !== 'total' && val !== 0)
          .map(([key, val]) => ({ label: XP_LABELS[key] || key, value: val as number }))
      : [];

    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowSettlementPopup(false)}>
        <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <p className="text-gray-400 text-sm">{data.date} 정산 결과</p>
            <p className={`text-4xl font-bold mt-2 ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{totalXpItem} XP
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">{data.team}</span>
            <span className="text-gray-600 text-sm">{data.battingOrder}번 타자</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${data.isCorrect ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'}`}>
              예측 {data.isCorrect ? '적중' : '실패'}
            </span>
          </div>

          {breakdownItems.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              <p className="text-gray-500 text-xs font-bold mb-2">XP 상세</p>
              {breakdownItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">{item.label}</span>
                  <span className={`text-sm font-bold ${item.value >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {item.value >= 0 ? '+' : ''}{item.value}
                  </span>
                </div>
              ))}
              {data.xpFromPrediction > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">승리 예측 보너스</span>
                  <span className="text-sm font-bold text-emerald-500">+{data.xpFromPrediction}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
                <span className="text-gray-800 text-sm font-bold">합계</span>
                <span className={`text-base font-bold ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{totalXpItem}
                </span>
              </div>
            </div>
          )}

          {!breakdown && (
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-[10px] mb-0.5">선수 성적</p>
                <p className="text-gray-700 text-sm font-bold">{(data.xpFromPlayer || 0) >= 0 ? '+' : ''}{data.xpFromPlayer || 0}</p>
              </div>
              <div className={`flex-1 rounded-xl p-3 text-center ${data.isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <p className="text-gray-400 text-[10px] mb-0.5">승리 예측</p>
                <p className={`text-sm font-bold ${data.isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>{data.isCorrect ? '+30' : '0'}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowSettlementPopup(false)}
            className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold shadow-md"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  /* ── 로딩 ── */
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── 캐릭터 없음 ── */
  if (!character) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-700 text-lg">캐릭터를 만들어주세요!</p>
        <button onClick={() => router.push('/character')} className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md">캐릭터 만들기</button>
      </div>
    );
  }

  /* ── 헬퍼: 구체 렌더 ── */
  function renderSphere(size: number) {
    return (
      <div className="rounded-full flex items-center justify-center relative" style={{
        width: `${size}px`, height: `${size}px`, background: theme.gradient,
        boxShadow: `0 ${size * 0.08}px ${size * 0.2}px ${theme.shadow}, inset 0 -${size * 0.04}px ${size * 0.1}px rgba(0,0,0,0.2), inset 0 ${size * 0.04}px ${size * 0.08}px rgba(255,255,255,0.3)`,
      }}>
        <span style={{ fontSize: `${size * 0.45}px` }}>{emoji}</span>
        <div className="absolute rounded-full bg-white/30 blur-sm" style={{ width: `${size * 0.25}px`, height: `${size * 0.15}px`, top: `${size * 0.12}px`, left: `${size * 0.2}px` }} />
      </div>
    );
  }

  /* ── 성장 비교 ── */
  if (screen === 'compare') {
    const initSize = 120;
    const curSize = Math.min(120 + xp * 0.08, 220);
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center gap-10 px-4">
          <div className="flex flex-col items-center gap-3">{renderSphere(initSize)}<span className="text-gray-400 text-xs">처음</span></div>
          <div className="flex flex-col items-center gap-3">{renderSphere(curSize)}<span className="text-gray-600 text-xs font-medium">지금 (XP: {xp})</span></div>
        </div>
        <div className="p-4 pb-20">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">돌아가기</button>
        </div>
      </div>
    );
  }

  /* ── 배치 기록 ── */
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
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${log.status === 'settled' ? 'bg-emerald-50 text-emerald-500' : 'bg-orange-50 text-orange-500'}`}>
                      {log.status === 'settled' ? '정산완료' : '대기중'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-800 text-sm font-medium">{log.team} {log.battingOrder}번 타자</span>
                    {log.status === 'settled' && (
                      <span className={`text-sm font-bold ${(log.xpFromPlayer + log.xpFromPrediction) >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {(log.xpFromPlayer + log.xpFromPrediction) >= 0 ? '+' : ''}{log.xpFromPlayer + log.xpFromPrediction} XP
                      </span>
                    )}
                  </div>
                  {log.predictedWinner && <span className="text-gray-400 text-xs">승리예측: {log.predictedWinner}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 pb-20">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">돌아가기</button>
        </div>
      </div>
    );
  }

  /* ── 오늘의 배치 ── */
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
              <button onClick={() => router.push('/match')} className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold shadow-md">배치 변경하기</button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-gray-400">오늘 배치가 없습니다</p>
              <button onClick={() => router.push('/match')} className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md">배치하러 가기</button>
            </div>
          )}
        </div>
        <div className="p-4 pb-20">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">돌아가기</button>
        </div>
      </div>
    );
  }

  /* ── 정산 결과 목록 (FAB에서 다시 보기) ── */
  if (screen === 'settlement') {
    const settled = history.filter((p: any) => p.status === 'settled');
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-gray-900 text-lg font-bold mb-4">정산 결과</h2>
          {settled.length === 0 ? (
            <p className="text-gray-400">아직 정산된 경기가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {settled.map((r: any, i: number) => {
                const total = (r.xpFromPlayer || 0) + (r.xpFromPrediction || 0);
                const isPos = total >= 0;
                const bd = r.xpBreakdown;
                const items = bd
                  ? Object.entries(bd).filter(([k, v]) => k !== 'total' && v !== 0).map(([k, v]) => ({ label: XP_LABELS[k] || k, value: v as number }))
                  : [];

                return (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400 text-xs">{r.date}</span>
                      <span className={`text-lg font-bold ${isPos ? 'text-emerald-500' : 'text-red-400'}`}>
                        {isPos ? '+' : ''}{total} XP
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">{r.team}</span>
                      <span className="text-gray-600 text-sm">{r.battingOrder}번 타자</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.isCorrect ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'}`}>
                        예측 {r.isCorrect ? '적중' : '실패'}
                      </span>
                    </div>
                    {items.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                        {items.map((item, j) => (
                          <div key={j} className="flex justify-between">
                            <span className="text-gray-500 text-xs">{item.label}</span>
                            <span className={`text-xs font-bold ${item.value >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                              {item.value >= 0 ? '+' : ''}{item.value}
                            </span>
                          </div>
                        ))}
                        {r.xpFromPrediction > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-xs">승리 예측 보너스</span>
                            <span className="text-xs font-bold text-emerald-500">+{r.xpFromPrediction}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 pb-20">
          <button onClick={() => setScreen('main')} className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-medium shadow-sm">돌아가기</button>
        </div>
      </div>
    );
  }

  /* ── 메인 화면: 3D 구체 + FAB ── */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* 정산 팝업 */}
      {showSettlementPopup && settlementData && renderSettlementPopup(settlementData)}

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="rounded-full bg-black/10 blur-xl" style={{ width: `${sphereSize * 0.8}px`, height: `${sphereSize * 0.15}px`, marginBottom: '-20px', zIndex: 0 }} />
        <div className="rounded-full flex items-center justify-center relative animate-bounce" style={{
          width: `${sphereSize}px`, height: `${sphereSize}px`, background: theme.gradient,
          boxShadow: `0 ${sphereSize * 0.08}px ${sphereSize * 0.2}px ${theme.shadow}, inset 0 -${sphereSize * 0.04}px ${sphereSize * 0.1}px rgba(0,0,0,0.2), inset 0 ${sphereSize * 0.04}px ${sphereSize * 0.08}px rgba(255,255,255,0.3)`,
          animationDuration: '3s', zIndex: 1,
        }}>
          <span style={{ fontSize: `${sphereSize * 0.45}px` }}>{emoji}</span>
          <div className="absolute rounded-full bg-white/30 blur-sm" style={{ width: `${sphereSize * 0.25}px`, height: `${sphereSize * 0.15}px`, top: `${sphereSize * 0.12}px`, left: `${sphereSize * 0.2}px` }} />
        </div>
        <p className="text-gray-900 font-bold text-xl mt-6">{character.name}</p>
        <p className="text-gray-400 text-xs mt-1">{ANIMAL_NAME[character.animalType]}</p>
      </div>

      {/* FAB 팝업 메뉴 */}
      {menuOpen && (
        <div className="fixed bottom-36 right-4 z-50 flex flex-col gap-2 items-end">
          <button onClick={() => { setMenuOpen(false); fetchHistory(); setScreen('settlement'); }} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg">
            정산 결과
          </button>
          <button onClick={() => { setMenuOpen(false); fetchHistory(); setScreen('history'); }} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg flex items-center gap-2">
            <span className="text-orange-500 font-bold">{xp} XP</span>
            <span>배치 기록</span>
          </button>
          <button onClick={() => { setMenuOpen(false); setScreen('placement'); }} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg flex items-center gap-2">
            {placement ? <span>{placement.team} {placement.battingOrder}번</span> : <span>오늘의 배치</span>}
          </button>
          <button onClick={() => { setMenuOpen(false); setScreen('compare'); }} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg">
            성장 비교
          </button>
        </div>
      )}

      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={`fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-xl z-50 transition-all duration-300 ${menuOpen ? 'bg-gray-700 text-white rotate-45' : 'bg-orange-400 text-white shadow-orange-300/40'}`}
      >
        {menuOpen ? '+' : '\u2630'}
      </button>
    </div>
  );
}
