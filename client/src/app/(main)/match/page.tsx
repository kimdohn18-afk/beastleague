'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getDisplayName } from '@beastleague/shared';
import { useRouter } from 'next/navigation';

interface Game {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  startTime?: string;
  homeScore?: number;
  awayScore?: number;
}

interface Prediction {
  _id: string;
  gameId: string;
  predictedWinner: string;
  scoreDiffRange?: string;
  xpBetOnDiff?: number;
  totalRunsRange?: string;
  xpBetOnTotal?: number;
  date: string;
  status: string;
  result?: any;
  game?: Game;
}

interface CharacterInfo {
  xp: number;
}

function isGameStartedByTime(game: Game): boolean {
  if (game.status === 'finished' || game.status === 'live') return true;
  if (game.status === 'cancelled') return true;
  if (!game.startTime || !game.date) return false;
  try {
    const [hour, minute] = game.startTime.split(':').map(Number);
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentDate = now.toISOString().slice(0, 10);
    if (currentDate === game.date) {
      return currentHour > hour || (currentHour === hour && currentMinute >= minute);
    }
  } catch {}
  return false;
}

export default function MatchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 탭 상태
  const [tab, setTab] = useState<'today' | 'history'>('today');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 선택 상태 (경기별)
  const [selections, setSelections] = useState<Record<string, {
    predictedWinner: string;
    scoreDiffRange?: string;
    xpBetOnDiff?: number;
    totalRunsRange?: string;
    xpBetOnTotal?: number;
  }>>({});

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  useEffect(() => {
    if (!token) return;
    fetchAll();
  }, [token]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [gamesRes, predsRes, charRes] = await Promise.all([
        fetch(`${apiUrl}/api/games?date=${todayKST()}`, { headers }),
        fetch(`${apiUrl}/api/predictions/today`, { headers }),
        fetch(`${apiUrl}/api/characters/me`, { headers }),
      ]);
      if (gamesRes.ok) setGames(await gamesRes.json());
      if (predsRes.ok) {
        const preds = await predsRes.json();
        setPredictions(preds);
        const sel: typeof selections = {};
        for (const p of preds) {
          sel[p.gameId] = {
            predictedWinner: p.predictedWinner,
            scoreDiffRange: p.scoreDiffRange,
            xpBetOnDiff: p.xpBetOnDiff,
            totalRunsRange: p.totalRunsRange,
            xpBetOnTotal: p.xpBetOnTotal,
          };
        }
        setSelections(sel);
      }
      if (charRes.ok) {
        const c = await charRes.json();
        setCharacter({ xp: c.xp });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/predictions/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHistoryData(await res.json());
    } catch (e) { console.error(e); }
    setHistoryLoading(false);
  }

  function handleTabChange(t: 'today' | 'history') {
    setTab(t);
    if (t === 'history' && historyData.length === 0) fetchHistory();
  }

  function getPrediction(gameId: string): Prediction | undefined {
    return predictions.find(p => p.gameId === gameId);
  }

  function getTotalBettedXp(): number {
    return predictions
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (p.xpBetOnDiff || 0) + (p.xpBetOnTotal || 0), 0);
  }

  function getAvailableXp(): number {
    return (character?.xp || 0) - getTotalBettedXp();
  }

  async function handleSubmit(gameId: string) {
    const sel = selections[gameId];
    if (!sel?.predictedWinner) {
      showToast('승리팀을 선택해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/predictions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          gameId,
          predictedWinner: sel.predictedWinner,
          scoreDiffRange: sel.scoreDiffRange || undefined,
          xpBetOnDiff: sel.xpBetOnDiff || undefined,
          totalRunsRange: sel.totalRunsRange || undefined,
          xpBetOnTotal: sel.xpBetOnTotal || undefined,
        }),
      });
      if (res.ok) {
        showToast('예측 완료!');
        setExpandedGame(null);
        await fetchAll();
      } else {
        const err = await res.json();
        showToast(err.error || '예측 실패');
      }
    } catch { showToast('오류 발생'); }
    setSubmitting(false);
  }

  async function handleCancel(gameId: string) {
    try {
      const res = await fetch(`${apiUrl}/api/predictions/${gameId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        showToast('예측 취소됨');
        await fetchAll();
      } else {
        const err = await res.json();
        showToast(err.error || '취소 실패');
      }
    } catch { showToast('오류 발생'); }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function updateSelection(gameId: string, updates: Partial<typeof selections[string]>) {
    setSelections(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], ...updates },
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeGames = games.filter(g => g.status !== 'cancelled');
  const predictedCount = predictions.filter(p => p.status === 'active').length;

  // 히스토리 계산
  const historySettled = historyData.filter((p: any) => p.status === 'settled' && p.result);
  const historyTotalNetXp = historySettled.reduce((s: number, p: any) => s + (p.result?.netXp || 0), 0);
  const historyCorrectCount = historySettled.filter((p: any) => p.result?.winCorrect).length;
  const historyAccuracy = historySettled.length > 0 ? Math.round((historyCorrectCount / historySettled.length) * 100) : 0;

  // 날짜별 그룹
  const dateGroupMap = new Map<string, any[]>();
  for (const p of historyData) {
    const arr = dateGroupMap.get(p.date) || [];
    arr.push(p);
    dateGroupMap.set(p.date, arr);
  }
  const dateGroups = Array.from(dateGroupMap.entries()).sort(([a], [b]) => b.localeCompare(a));
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => handleTabChange('today')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'today' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'
          }`}
        >오늘 경기</button>
        <button
          onClick={() => handleTabChange('history')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'history' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'
          }`}
        >내 기록</button>
      </div>

      {/* ===== 오늘 경기 탭 ===== */}
      {tab === 'today' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-gray-900 text-lg font-bold">{todayKST()}</h1>
              <p className="text-gray-400 text-sm">{activeGames.length}경기 · {predictedCount}/5 예측</p>
            </div>
            <div className="bg-orange-50 px-3 py-1.5 rounded-full">
              <span className="text-orange-500 text-sm font-bold">{getAvailableXp()} XP</span>
            </div>
          </div>

          {games.length === 0 ? (
            <p className="text-gray-400 text-center mt-20">오늘 경기가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const isCancelled = game.status === 'cancelled';
                const isExpanded = expandedGame === game.gameId;
                const isLocked = isGameStartedByTime(game);
                const pred = getPrediction(game.gameId);
                const isSettled = pred?.status === 'settled';
                const sel = selections[game.gameId];
                const hasPrediction = !!pred;

                const homeDisplay = getDisplayName(game.homeTeam as any);
                const awayDisplay = getDisplayName(game.awayTeam as any);

                return (
                  <div key={game.gameId} className={`rounded-2xl overflow-hidden shadow-sm ${
                    isCancelled ? 'opacity-50' : hasPrediction ? 'ring-2 ring-orange-400' : ''
                  }`}>
                    <div
                      onClick={() => !isCancelled && !isSettled && setExpandedGame(isExpanded ? null : game.gameId)}
                      className={`bg-white p-4 border border-gray-100 ${
                        isCancelled || isSettled ? 'opacity-60' : 'cursor-pointer active:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-medium flex-1 text-center ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {awayDisplay}
                        </span>
                        <span className="text-gray-300 text-sm mx-3">
                          {isCancelled ? '취소'
                            : game.status === 'finished' ? `${game.awayScore} : ${game.homeScore}`
                            : isLocked ? '진행 중'
                            : game.startTime || 'vs'}
                        </span>
                        <span className={`font-medium flex-1 text-center ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {homeDisplay}
                        </span>
                      </div>

                      {isSettled && pred?.result && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex justify-between items-center">
                            <span className={pred.result.winCorrect ? 'text-emerald-500 text-xs font-bold' : 'text-red-400 text-xs'}>
                              {pred.result.winCorrect ? '✅ 적중' : '❌ 실패'}
                            </span>
                            <span className={`text-sm font-bold ${pred.result.netXp >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                              {pred.result.netXp >= 0 ? '+' : ''}{pred.result.netXp} XP
                            </span>
                          </div>
                        </div>
                      )}

                      {hasPrediction && !isSettled && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-orange-500 text-xs">
                            {getDisplayName(pred!.predictedWinner as any)} 승리 예측
                            {pred!.scoreDiffRange && ` · 점수차 ${pred!.scoreDiffRange}`}
                            {pred!.totalRunsRange && ` · 총득점 ${pred!.totalRunsRange}`}
                          </span>
                          {!isLocked && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancel(game.gameId); }}
                              className="text-xs text-red-400 underline"
                            >취소</button>
                          )}
                        </div>
                      )}
                    </div>

                    {isExpanded && !isCancelled && !isSettled && !isLocked && (
                      <div className="bg-white border-t border-gray-100 p-4 space-y-4">
                        <div>
                          <p className="text-gray-400 text-xs mb-2">승리 예측 (무료 · 적중 시 +20 XP)</p>
                          <div className="flex gap-3">
                            {[game.awayTeam, game.homeTeam].map((t) => (
                              <button
                                key={t}
                                onClick={() => updateSelection(game.gameId, { predictedWinner: t })}
                                className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
                                  sel?.predictedWinner === t
                                    ? 'bg-orange-400 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >{getDisplayName(t as any)}</button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-gray-400 text-xs mb-2">점수차 예측 (선택 · XP 베팅)</p>
                          <div className="flex gap-2 mb-2">
                            {[
                              { value: '1-2', label: '1~2점', mult: '×1.5' },
                              { value: '3-4', label: '3~4점', mult: '×2' },
                              { value: '5+', label: '5점+', mult: '×3' },
                            ].map(({ value, label, mult }) => (
                              <button
                                key={value}
                                onClick={() => updateSelection(game.gameId, {
                                  scoreDiffRange: sel?.scoreDiffRange === value ? undefined : value,
                                  xpBetOnDiff: sel?.scoreDiffRange === value ? undefined : sel?.xpBetOnDiff,
                                })}
                                className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
                                  sel?.scoreDiffRange === value
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {label}<br/><span className="text-[10px] opacity-75">{mult}</span>
                              </button>
                            ))}
                          </div>
                          {sel?.scoreDiffRange && (
                            <input
                              type="number"
                              placeholder="베팅 XP"
                              value={sel.xpBetOnDiff || ''}
                              onChange={(e) => updateSelection(game.gameId, { xpBetOnDiff: parseInt(e.target.value) || 0 })}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                            />
                          )}
                        </div>

                        <div>
                          <p className="text-gray-400 text-xs mb-2">총득점 예측 (선택 · XP 베팅)</p>
                          <div className="flex gap-2 mb-2">
                            {[
                              { value: 'low', label: '로우 0~5', mult: '×2' },
                              { value: 'normal', label: '보통 6~9', mult: '×1.5' },
                              { value: 'high', label: '하이 10+', mult: '×2.5' },
                            ].map(({ value, label, mult }) => (
                              <button
                                key={value}
                                onClick={() => updateSelection(game.gameId, {
                                  totalRunsRange: sel?.totalRunsRange === value ? undefined : value,
                                  xpBetOnTotal: sel?.totalRunsRange === value ? undefined : sel?.xpBetOnTotal,
                                })}
                                className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
                                  sel?.totalRunsRange === value
                                    ? 'bg-purple-500 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {label}<br/><span className="text-[10px] opacity-75">{mult}</span>
                              </button>
                            ))}
                          </div>
                          {sel?.totalRunsRange && (
                            <input
                              type="number"
                              placeholder="베팅 XP"
                              value={sel.xpBetOnTotal || ''}
                              onChange={(e) => updateSelection(game.gameId, { xpBetOnTotal: parseInt(e.target.value) || 0 })}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                            />
                          )}
                        </div>

                        <button
                          onClick={() => handleSubmit(game.gameId)}
                          disabled={submitting || !sel?.predictedWinner}
                          className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 shadow-md"
                        >
                          {submitting ? '처리 중...' : hasPrediction ? '예측 수정' : '예측 확정'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== 내 기록 탭 ===== */}
      {tab === 'history' && (
        historyLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* 상단 요약 */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">총 획득</p>
                <p className={`text-xl font-bold ${historyTotalNetXp >= 0 ? 'text-orange-500' : 'text-red-400'}`}>
                  {historyTotalNetXp >= 0 ? '+' : ''}{historyTotalNetXp} XP
                </p>
              </div>
              <div className="flex-1 bg-emerald-50 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">적중</p>
                <p className="text-emerald-500 text-xl font-bold">{historyCorrectCount}/{historySettled.length}</p>
              </div>
              <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">적중률</p>
                <p className="text-blue-500 text-xl font-bold">{historyAccuracy}%</p>
              </div>
            </div>

            {/* 날짜별 그룹 */}
            {dateGroups.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 mb-4">아직 예측 기록이 없습니다</p>
                <button
                  onClick={() => handleTabChange('today')}
                  className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
                >
                  경기 예측하러 가기
                </button>
              </div>
            ) : (
              dateGroups.map(([date, preds]) => {
                const isOpen = expandedDate === date || (expandedDate === null && date === dateGroups[0]?.[0]);
                const settled = preds.filter((p: any) => p.status === 'settled' && p.result);
                const netXp = settled.reduce((s: number, p: any) => s + (p.result?.netXp || 0), 0);
                const correct = settled.filter((p: any) => p.result?.winCorrect).length;
                const [y, m, d] = date.split('-').map(Number);
                const dayName = weekdays[new Date(y, m - 1, d).getDay()];

                return (
                  <div key={date} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setExpandedDate(isOpen ? '__close__' : date)}
                      className="w-full px-4 py-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 font-bold">{m}월 {d}일 ({dayName})</span>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
                          {preds.length}경기
                        </span>
                        {settled.length > 0 && (
                          <span className="text-xs text-gray-400">
                            적중 {correct}/{settled.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {settled.length > 0 ? (
                          <span className={`text-sm font-bold ${netXp >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {netXp >= 0 ? '+' : ''}{netXp} XP
                          </span>
                        ) : (
                          <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">대기중</span>
                        )}
                        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-50 px-3 pb-3 space-y-2">
                        {preds.map((p: any) => {
                          const isSettled = p.status === 'settled';
                          const pNetXp = p.result?.netXp || 0;
                          const isDetail = expandedId === p._id;
                          const matchLabel = p.game
                            ? `${getDisplayName(p.game.awayTeam as any)} vs ${getDisplayName(p.game.homeTeam as any)}`
                            : p.gameId;

                          return (
                            <div key={p._id} className="bg-gray-50 rounded-xl overflow-hidden">
                              <div className="p-3">
                                <div className="flex justify-between items-center mb-1">
                                  <p className="font-semibold text-gray-900 text-sm">{matchLabel}</p>
                                  {isSettled && (
                                    <span className={`text-sm font-bold ${pNetXp >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                      {pNetXp >= 0 ? '+' : ''}{pNetXp}
                                    </span>
                                  )}
                                  {!isSettled && <span className="text-xs text-yellow-600">대기중</span>}
                                </div>

                                {p.game?.status === 'finished' && (
                                  <p className="text-gray-400 text-xs mb-1">
                                    {p.game.awayScore} : {p.game.homeScore}
                                  </p>
                                )}

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                                    {getDisplayName(p.predictedWinner as any)} 승
                                    {isSettled && p.result && (p.result.winCorrect ? ' ✅' : ' ❌')}
                                  </span>
                                  {p.scoreDiffRange && (
                                    <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                                      차 {p.scoreDiffRange}
                                      {isSettled && p.result?.diffCorrect !== undefined && (p.result.diffCorrect ? ' ✅' : ' ❌')}
                                    </span>
                                  )}
                                  {p.totalRunsRange && (
                                    <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full">
                                      총 {p.totalRunsRange}
                                      {isSettled && p.result?.totalCorrect !== undefined && (p.result.totalCorrect ? ' ✅' : ' ❌')}
                                    </span>
                                  )}
                                </div>

                                {isSettled && p.result && (
                                  <button
                                    onClick={() => setExpandedId(isDetail ? null : p._id)}
                                    className="text-xs text-gray-400 underline mt-2"
                                  >{isDetail ? '접기' : '상세'}</button>
                                )}
                              </div>

                              {isDetail && isSettled && p.result && (
                                <div className="border-t border-gray-200 px-3 py-2 bg-white space-y-1.5 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">승리 예측</span>
                                    <span className={p.result.winCorrect ? 'text-emerald-500' : 'text-red-400'}>
                                      {p.result.winCorrect ? `✅ +${p.result.xpFromWin}` : '❌ 0'}
                                    </span>
                                  </div>
                                  {p.result.diffCorrect !== undefined && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">점수차 {p.scoreDiffRange}</span>
                                      <span className={p.result.diffCorrect ? 'text-emerald-500' : 'text-red-400'}>
                                        {p.result.diffCorrect ? `✅ +${p.result.xpFromDiff}` : `❌ -${p.result.xpLostDiff}`}
                                      </span>
                                    </div>
                                  )}
                                  {p.result.totalCorrect !== undefined && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">총득점 {p.totalRunsRange}</span>
                                      <span className={p.result.totalCorrect ? 'text-emerald-500' : 'text-red-400'}>
                                        {p.result.totalCorrect ? `✅ +${p.result.xpFromTotal}` : `❌ -${p.result.xpLostTotal}`}
                                      </span>
                                    </div>
                                  )}
                                  <div className="pt-1.5 border-t border-gray-100 flex justify-between font-bold">
                                    <span className="text-gray-700">합계</span>
                                    <span className={pNetXp >= 0 ? 'text-emerald-500' : 'text-red-400'}>
                                      {pNetXp >= 0 ? '+' : ''}{pNetXp} XP
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )
      )}
    </div>
  );
}
