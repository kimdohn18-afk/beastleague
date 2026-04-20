'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getDisplayName } from '@beastleague/shared';

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
  const [games, setGames] = useState<Game[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
        // 기존 예측을 selections에 반영
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

  function getPrediction(gameId: string): Prediction | undefined {
    return predictions.find(p => p.gameId === gameId);
  }

  // 현재 총 베팅 XP (active 상태만)
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">
          {toast}
        </div>
      )}

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
                {/* 경기 카드 헤더 */}
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

                  {/* 예측 결과 (정산 완료) */}
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

                  {/* 예측 요약 (미정산) */}
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

                {/* 예측 입력 패널 */}
                {isExpanded && !isCancelled && !isSettled && !isLocked && (
                  <div className="bg-white border-t border-gray-100 p-4 space-y-4">
                    {/* 승리 예측 (무료) */}
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

                    {/* 점수차 예측 (선택) */}
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

                    {/* 총득점 예측 (선택) */}
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
    </div>
  );
}
