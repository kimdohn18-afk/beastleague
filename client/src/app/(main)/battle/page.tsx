'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface MatchStatus {
  played: number;
  maxMatches: number;
  remaining: number;
  hasPrediction: boolean;
  activeMatch: {
    matchId: string;
    startedAt: string;
    completedAt: string;
    isReady: boolean;
    remainingMs: number;
  } | null;
  hasUnclaimed: boolean;
}

interface ClaimResult {
  result: {
    myScore: number;
    oppScore: number;
    win: boolean;
    personal: {
      atBats: number;
      hits: number;
      doubles: number;
      homeRuns: number;
      walks: number;
      stolenBases: number;
      runs: number;
      errors: number;
      mvp: boolean;
    };
  };
  statGain: Record<string, number>;
  xpReward: number;
  droppedItem: {
    id: string;
    name: string;
    icon: string;
    rarity: string;
    slot: string;
    effect: { stat?: string; value: number; xpBonus?: number };
  } | null;
  currentXp: number;
  totalXp: number;
  stats: Record<string, number>;
}

interface CareerStats {
  totalGames: number;
  wins: number;
  winRate: number;
  avg: string;
  totalHits: number;
  totalDoubles: number;
  totalHomeRuns: number;
  totalWalks: number;
  totalStolenBases: number;
  totalRuns: number;
  totalErrors: number;
  mvpCount: number;
  totalXpEarned: number;
}

interface StatsData {
  stats: Record<string, number>;
  upgradeCosts: Record<string, number>;
  totalStats: number;
  currentXp: number;
  totalXp: number;
}

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-gray-100 text-gray-600 border-gray-200',
  rare: 'bg-blue-50 text-blue-600 border-blue-200',
  epic: 'bg-purple-50 text-purple-600 border-purple-200',
  legendary: 'bg-yellow-50 text-yellow-600 border-yellow-300',
};

const RARITY_NAMES: Record<string, string> = {
  common: '일반', rare: '레어', epic: '에픽', legendary: '전설',
};

const STAT_INFO: Record<string, { emoji: string; name: string; short: string }> = {
  power:   { emoji: '💪', name: '파워', short: '장타력' },
  skill:   { emoji: '🎯', name: '기술', short: '안타' },
  agility: { emoji: '⚡', name: '민첩', short: '도루·득점' },
  stamina: { emoji: '❤️', name: '체력', short: '수비' },
  mind:    { emoji: '🧠', name: '정신', short: '선구안' },
};

function formatTime(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function BattlePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<'match' | 'career'>('match');
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [career, setCareer] = useState<CareerStats | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (token) {
      fetchStatus();
      fetchStatsData();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [token, authStatus]);

  useEffect(() => {
    if (matchStatus?.activeMatch && !matchStatus.activeMatch.isReady) {
      setRemainingMs(matchStatus.activeMatch.remainingMs);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRemainingMs(prev => {
          if (prev <= 1000) {
            if (timerRef.current) clearInterval(timerRef.current);
            fetchStatus();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
  }, [matchStatus?.activeMatch]);

  async function fetchStatus() {
    try {
      const res = await fetch(`${apiUrl}/api/virtual-match/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMatchStatus(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchStatsData() {
    try {
      const res = await fetch(`${apiUrl}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatsData(await res.json());
    } catch (e) { console.error(e); }
  }

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setClaimResult(null);
    try {
      const res = await fetch(`${apiUrl}/api/virtual-match/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        showToast('경기 시작! 4시간 후 결과를 확인하세요');
        await fetchStatus();
      } else {
        showToast(data.error || '경기 시작 실패');
      }
    } catch { showToast('네트워크 오류'); }
    setStarting(false);
  }

  async function handleClaim(matchId: string) {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await fetch(`${apiUrl}/api/virtual-match/claim/${matchId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setClaimResult(data);
        await fetchStatus();
        await fetchStatsData();
      } else {
        showToast(data.error || '결과 수령 실패');
      }
    } catch { showToast('네트워크 오류'); }
    setClaiming(false);
  }

  async function handleUpgrade(stat: string) {
    if (upgrading || !statsData) return;
    const cost = statsData.upgradeCosts[stat];
    if (statsData.currentXp < cost) {
      showToast(`XP 부족 (${cost} XP 필요)`);
      return;
    }
    setUpgrading(stat);
    try {
      const res = await fetch(`${apiUrl}/api/stats/upgrade`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stat }),
      });
      const result = await res.json();
      if (res.ok) {
        setStatsData(prev => prev ? {
          ...prev,
          stats: result.stats,
          currentXp: result.currentXp,
          upgradeCosts: {
            ...prev.upgradeCosts,
            [stat]: prev.upgradeCosts[stat] + 5,
          },
          totalStats: Object.values(result.stats as Record<string, number>).reduce((a, b) => a + b, 0),
        } : prev);
        const info = STAT_INFO[stat];
        showToast(`${info.emoji} ${info.name} Lv.${result.newLevel}!`);
      } else {
        showToast(result.error || '업그레이드 실패');
      }
    } catch { showToast('네트워크 오류'); }
    setUpgrading(null);
  }

  async function fetchCareer() {
    try {
      const res = await fetch(`${apiUrl}/api/virtual-match/career`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCareer(await res.json());
    } catch (e) { console.error(e); }
  }

  function handleTabChange(t: 'match' | 'career') {
    setTab(t);
    if (t === 'career' && !career) fetchCareer();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  if (loading || authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasActive = matchStatus?.activeMatch && !matchStatus.activeMatch.isReady;
  const isReady = matchStatus?.activeMatch?.isReady || matchStatus?.hasUnclaimed;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-3">
        <h1 className="text-lg font-bold text-gray-900 mb-3">⚾ 경기 뛰기</h1>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => handleTabChange('match')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'match' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'
            }`}
          >경기</button>
          <button
            onClick={() => handleTabChange('career')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'career' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'
            }`}
          >통산 기록</button>
        </div>
      </div>

      {/* ===== 경기 탭 ===== */}
      {tab === 'match' && (
        <div className="p-4 space-y-4">

          {/* 경기 상태 통합 카드 */}
          {matchStatus && !claimResult && (
            <div className={`rounded-2xl p-5 border-2 ${
              hasActive ? 'bg-orange-50 border-orange-200' :
              isReady ? 'bg-emerald-50 border-emerald-300' :
              matchStatus.remaining > 0 ? 'bg-white border-gray-100' :
              'bg-gray-50 border-gray-200'
            }`}>

              {/* 진행 중 */}
              {hasActive && matchStatus.activeMatch && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚾</span>
                      <span className="text-sm font-bold text-gray-700">경기 진행 중</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {matchStatus.played}/{matchStatus.maxMatches} 사용
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-orange-500 text-center mb-2 font-mono">
                    {formatTime(remainingMs)}
                  </p>
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-orange-400 h-full transition-all duration-1000"
                      style={{ width: `${Math.max(0, 100 - (remainingMs / (4 * 60 * 60 * 1000)) * 100)}%` }}
                    />
                  </div>
                </>
              )}

              {/* 결과 대기 */}
              {isReady && !hasActive && matchStatus.activeMatch && (
                <>
                  <div className="text-center mb-3">
                    <span className="text-3xl">🎉</span>
                    <p className="text-sm font-bold text-gray-700 mt-1">경기가 끝났습니다!</p>
                  </div>
                  <button
                    onClick={() => handleClaim(matchStatus.activeMatch!.matchId)}
                    disabled={claiming}
                    className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-[0.98] disabled:opacity-50"
                  >
                    {claiming ? '수령 중...' : '결과 확인하기'}
                  </button>
                </>
              )}

              {/* 출전 가능 */}
              {!hasActive && !isReady && matchStatus.remaining > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-700">오늘 남은 횟수</span>
                    <span className="text-lg font-bold text-orange-500">
                      {matchStatus.remaining} / {matchStatus.maxMatches}
                    </span>
                  </div>
                  {!matchStatus.hasPrediction && matchStatus.maxMatches < 2 && (
                    <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-1.5 mb-3">
                      💡 오늘 경기 예측하면 추가 1회!
                    </p>
                  )}
                  <button
                    onClick={handleStart}
                    disabled={starting}
                    className="w-full bg-orange-400 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    {starting ? '출전 중...' : '⚾ 경기 출전! (4시간)'}
                  </button>
                </>
              )}

              {/* 다 소진 */}
              {!hasActive && !isReady && matchStatus.remaining <= 0 && (
                <div className="text-center py-2">
                  <span className="text-2xl">✅</span>
                  <p className="text-sm font-bold text-gray-500 mt-1">오늘 경기 완료!</p>
                  <p className="text-xs text-gray-400 mt-0.5">{matchStatus.played}/{matchStatus.maxMatches} 사용</p>
                </div>
              )}
            </div>
          )}

          {/* 결과 표시 */}
          {claimResult && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-5 text-center border-2 ${
                claimResult.result.win ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
              }`}>
                <div className="text-4xl mb-2">
                  {claimResult.result.personal.mvp ? '🏆' : claimResult.result.win ? '✅' : '❌'}
                </div>
                <h2 className={`text-xl font-bold ${claimResult.result.win ? 'text-green-600' : 'text-red-600'}`}>
                  {claimResult.result.personal.mvp ? 'MVP 승리!' : claimResult.result.win ? '승리!' : '패배...'}
                </h2>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {claimResult.result.myScore} : {claimResult.result.oppScore}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: '타수', val: claimResult.result.personal.atBats },
                    { label: '안타', val: claimResult.result.personal.hits },
                    { label: '2루타', val: claimResult.result.personal.doubles },
                    { label: '홈런', val: claimResult.result.personal.homeRuns },
                    { label: '볼넷', val: claimResult.result.personal.walks },
                    { label: '도루', val: claimResult.result.personal.stolenBases },
                    { label: '득점', val: claimResult.result.personal.runs },
                    { label: '실책', val: claimResult.result.personal.errors },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-[10px] text-gray-400">{label}</p>
                      <p className="text-lg font-bold text-gray-800">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {Object.values(claimResult.statGain).some(v => v > 0) && (
                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-emerald-600">📈</span>
                    {Object.entries(claimResult.statGain)
                      .filter(([, v]) => v > 0)
                      .map(([stat, val]) => (
                        <span key={stat} className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">
                          {STAT_INFO[stat]?.name || stat} +{val}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1 bg-orange-50 rounded-xl p-3 border border-orange-100 text-center">
                  <p className="text-[10px] text-gray-400">XP 획득</p>
                  <p className="text-base font-bold text-orange-500">+{claimResult.xpReward}</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400">보유 XP</p>
                  <p className="text-base font-bold text-gray-700">{claimResult.currentXp.toLocaleString()}</p>
                </div>
              </div>

              {claimResult.droppedItem ? (
                <div className={`rounded-2xl p-3 border-2 ${RARITY_COLORS[claimResult.droppedItem.rarity] || 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{claimResult.droppedItem.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{claimResult.droppedItem.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/50 font-medium">
                          {RARITY_NAMES[claimResult.droppedItem.rarity]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {STAT_INFO[claimResult.droppedItem.effect.stat || '']?.name || claimResult.droppedItem.effect.stat} +{claimResult.droppedItem.effect.value}
                      </p>
                    </div>
                    <span className="text-lg">🎁</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
                  <p className="text-xs text-gray-400">아이템 드롭 없음</p>
                </div>
              )}

              {matchStatus && matchStatus.remaining > 0 && (
                <button
                  onClick={() => setClaimResult(null)}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-white border border-orange-300 text-orange-500"
                >
                  한 번 더! ({matchStatus.remaining}회 남음)
                </button>
              )}
            </div>
          )}

          {/* ===== 능력치 섹션 ===== */}
          {statsData && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">내 능력치</span>
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                  {statsData.currentXp.toLocaleString()} XP
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {Object.entries(STAT_INFO).map(([key, info]) => {
                  const level = statsData.stats[key] || 1;
                  const cost = statsData.upgradeCosts[key];
                  const canAfford = statsData.currentXp >= cost;

                  return (
                    <div key={key} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-base">{info.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-800">{info.name}</span>
                          <span className="text-[10px] text-gray-400">{info.short}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-orange-400 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min((level / 99) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-orange-500 w-10 text-right">{level}</span>
                      <button
                        onClick={() => handleUpgrade(key)}
                        disabled={!canAfford || upgrading === key}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${
                          canAfford
                            ? 'bg-orange-400 text-white active:scale-95'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {upgrading === key ? '...' : `${cost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== 통산 기록 탭 ===== */}
      {tab === 'career' && (
        <div className="p-4">
          {!career ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : career.totalGames === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-gray-400">아직 경기 기록이 없습니다</p>
              <button
                onClick={() => handleTabChange('match')}
                className="mt-4 bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
              >
                첫 경기 뛰러 가기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-400">경기 수</p>
                    <p className="text-xl font-bold text-gray-800">{career.totalGames}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">승률</p>
                    <p className="text-xl font-bold text-orange-500">{career.winRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">타율</p>
                    <p className="text-xl font-bold text-blue-500">{career.avg}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 font-bold mb-3">통산 기록</p>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  {[
                    { label: '안타', val: career.totalHits },
                    { label: '2루타', val: career.totalDoubles },
                    { label: '홈런', val: career.totalHomeRuns },
                    { label: '볼넷', val: career.totalWalks },
                    { label: '도루', val: career.totalStolenBases },
                    { label: '득점', val: career.totalRuns },
                    { label: '실책', val: career.totalErrors },
                    { label: 'MVP', val: career.mvpCount },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{label}</span>
                      <span className="text-sm font-bold text-gray-800">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">경기로 획득한 총 XP</span>
                  <span className="text-lg font-bold text-orange-500">{career.totalXpEarned.toLocaleString()} XP</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
