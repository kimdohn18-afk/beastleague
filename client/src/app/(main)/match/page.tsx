'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getDisplayName } from '@beastleague/shared';
import { useRouter } from 'next/navigation';

// ─── 타입 정의 ───

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
  team?: string;
  battingOrder?: number;
  date: string;
  status: string;
  result?: {
    netXp?: number;
    winCorrect?: boolean;
    xpFromWin?: number;
    xpFromPlayer?: number;
    xpFromTeamWin?: number;
    xpFromWinPredict?: number;
    batterResult?: {
      playerName?: string;
      atBats?: number;
      hits?: number;
      homeRuns?: number;
      rbi?: number;
      runs?: number;
      stolenBases?: number;
      doubles?: number;
      triples?: number;
    };
  };
  game?: Game;
}

interface CharacterInfo {
  xp: number;
}

// ─── 유틸 ───

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

const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

const MAX_PLACEMENTS = 1; // 하루 최대 배치 수

// ─── 컴포넌트 ───

export default function MatchPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [games, setGames] = useState<Game[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [selections, setSelections] = useState<
    Record<string, { team: string; battingOrder: number | null }>
  >({});

  const [tab, setTab] = useState<'today' | 'history'>('today');
  const [historyData, setHistoryData] = useState<Prediction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ─── 데이터 페칭 ───

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
        const preds: Prediction[] = await predsRes.json();
        setPredictions(preds);
        const sel: typeof selections = {};
        for (const p of preds) {
          if (p.team && p.battingOrder) {
            sel[p.gameId] = { team: p.team, battingOrder: p.battingOrder };
          }
        }
        setSelections(sel);
      }
      if (charRes.ok) {
        const c = await charRes.json();
        setCharacter({ xp: c.xp });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/predictions/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setHistoryData(await res.json());
    } catch (e) {
      console.error(e);
    }
    setHistoryLoading(false);
  }

  // ─── 핸들러 ───

  function handleTabChange(t: 'today' | 'history') {
    setTab(t);
    if (t === 'history' && historyData.length === 0) fetchHistory();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function getPrediction(gameId: string) {
    return predictions.find((p) => p.gameId === gameId);
  }

  function updateSelection(
    gameId: string,
    updates: Partial<{ team: string; battingOrder: number | null }>
  ) {
    setSelections((prev) => ({
      ...prev,
      [gameId]: {
        team: prev[gameId]?.team || '',
        battingOrder: prev[gameId]?.battingOrder ?? null,
        ...updates,
      },
    }));
  }

  async function handleSubmit(gameId: string) {
    const sel = selections[gameId];
    if (!sel?.team) {
      showToast('팀을 선택해주세요');
      return;
    }
    if (!sel?.battingOrder) {
      showToast('타순을 선택해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/predictions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          gameId,
          predictedWinner: sel.team,
          team: sel.team,
          battingOrder: sel.battingOrder,
        }),
      });
      if (res.ok) {
        showToast('배치 완료!');
        setExpandedGame(null);
        await fetchAll();
      } else {
        const err = await res.json();
        showToast(err.error || '배치 실패');
      }
    } catch {
      showToast('오류 발생');
    }
    setSubmitting(false);
  }

  async function handleCancel(gameId: string) {
    try {
      const res = await fetch(`${apiUrl}/api/predictions/${gameId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        showToast('배치 취소됨');
        setSelections((prev) => {
          const next = { ...prev };
          delete next[gameId];
          return next;
        });
        await fetchAll();
      } else {
        const err = await res.json();
        showToast(err.error || '취소 실패');
      }
    } catch {
      showToast('오류 발생');
    }
  }

  // ─── 로딩 ───

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── 계산 ───

  const activeGames = games.filter((g) => g.status !== 'cancelled');
  const placedCount = predictions.filter((p) => p.status === 'active').length;
  const isMaxPlaced = placedCount >= MAX_PLACEMENTS;

  const historySettled = historyData.filter(
    (p) => p.status === 'settled' && p.result
  );
  const historyTotalNetXp = historySettled.reduce(
    (s, p) => s + (p.result?.netXp || 0),
    0
  );
  const historyCorrectCount = historySettled.filter(
    (p) => p.result?.winCorrect
  ).length;
  const historyAccuracy =
    historySettled.length > 0
      ? Math.round((historyCorrectCount / historySettled.length) * 100)
      : 0;

  const dateGroupMap = new Map<string, Prediction[]>();
  for (const p of historyData) {
    const arr = dateGroupMap.get(p.date) || [];
    arr.push(p);
    dateGroupMap.set(p.date, arr);
  }
  const dateGroups = Array.from(dateGroupMap.entries()).sort(([a], [b]) =>
    b.localeCompare(a)
  );

  // ─── 렌더링 ───

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
            tab === 'today'
              ? 'bg-white text-orange-500 shadow-sm'
              : 'text-gray-400'
          }`}
        >
          오늘 경기
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'history'
              ? 'bg-white text-orange-500 shadow-sm'
              : 'text-gray-400'
          }`}
        >
          내 기록
        </button>
      </div>

      {/* ===== 오늘 경기 탭 ===== */}
      {tab === 'today' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-gray-900 text-lg font-bold">{todayKST()}</h1>
              <p className="text-gray-400 text-sm">
                {activeGames.length}경기 · {placedCount}/{MAX_PLACEMENTS} 배치
              </p>
            </div>
            <div className="bg-orange-50 px-3 py-1.5 rounded-full">
              <span className="text-orange-500 text-sm font-bold">
                {character?.xp || 0} XP
              </span>
            </div>
          </div>

          {/* 배치 완료 안내 */}
          {isMaxPlaced && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4 text-center">
              <p className="text-orange-600 text-sm font-medium">
                오늘의 배치를 완료했습니다! 경기 결과를 기다려주세요
              </p>
            </div>
          )}

          {games.length === 0 ? (
            <p className="text-gray-400 text-center mt-20">
              오늘 경기가 없습니다
            </p>
          ) : (
            <div className="space-y-3">
              {games.map((game) => {
                const isCancelled = game.status === 'cancelled';
                const isExpanded = expandedGame === game.gameId;
                const isLocked = isGameStartedByTime(game);
                const pred = getPrediction(game.gameId);
                const isSettled = pred?.status === 'settled';
                const hasPrediction = !!pred;
                const sel = selections[game.gameId];

                // 이미 다른 경기에 배치했고 이 경기는 배치 안 한 경우
                const isBlocked = isMaxPlaced && !hasPrediction;

                const homeDisplay = getDisplayName(game.homeTeam as any);
                const awayDisplay = getDisplayName(game.awayTeam as any);

                return (
                  <div
                    key={game.gameId}
                    className={`rounded-2xl overflow-hidden shadow-sm ${
                      isCancelled || isBlocked
                        ? 'opacity-50'
                        : hasPrediction
                        ? 'ring-2 ring-orange-400'
                        : ''
                    }`}
                  >
                    {/* 경기 헤더 */}
                    <div
                      onClick={() => {
                        if (isCancelled || isSettled) return;
                        if (isBlocked) {
                          showToast('하루 1경기만 배치할 수 있습니다');
                          return;
                        }
                        setExpandedGame(isExpanded ? null : game.gameId);
                      }}
                      className={`bg-white p-4 border border-gray-100 ${
                        isCancelled || isSettled || isBlocked
                          ? 'opacity-60'
                          : 'cursor-pointer active:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-medium flex-1 text-center ${
                            isCancelled
                              ? 'text-gray-400 line-through'
                              : 'text-gray-800'
                          }`}
                        >
                          {awayDisplay}
                        </span>
                        <span className="text-gray-300 text-sm mx-3">
                          {isCancelled
                            ? '취소'
                            : game.status === 'finished'
                            ? `${game.awayScore} : ${game.homeScore}`
                            : isLocked
                            ? '진행 중'
                            : game.startTime || 'vs'}
                        </span>
                        <span
                          className={`font-medium flex-1 text-center ${
                            isCancelled
                              ? 'text-gray-400 line-through'
                              : 'text-gray-800'
                          }`}
                        >
                          {homeDisplay}
                        </span>
                      </div>

                      {/* 정산 완료 결과 */}
                      {isSettled && pred?.result && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  pred.result.winCorrect
                                    ? 'text-emerald-500 text-xs font-bold'
                                    : 'text-red-400 text-xs'
                                }
                              >
                                {pred.result.winCorrect ? '✅ 적중' : '❌ 실패'}
                              </span>
                              {pred.battingOrder && (
                                <span className="text-gray-400 text-xs">
                                  {pred.battingOrder}번 타자
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-sm font-bold ${
                                (pred.result.netXp || 0) >= 0
                                  ? 'text-emerald-500'
                                  : 'text-red-400'
                              }`}
                            >
                              {(pred.result.netXp || 0) >= 0 ? '+' : ''}
                              {pred.result.netXp} XP
                            </span>
                          </div>
                          {pred.result.batterResult?.playerName && (
                            <p className="text-gray-400 text-xs mt-1">
                              {pred.result.batterResult.playerName}:{' '}
                              {pred.result.batterResult.atBats}타수{' '}
                              {pred.result.batterResult.hits}안타
                              {(pred.result.batterResult.homeRuns || 0) > 0 &&
                                ` ${pred.result.batterResult.homeRuns}홈런`}
                              {(pred.result.batterResult.rbi || 0) > 0 &&
                                ` ${pred.result.batterResult.rbi}타점`}
                              {(pred.result.batterResult.stolenBases || 0) > 0 &&
                                ` ${pred.result.batterResult.stolenBases}도루`}
                            </p>
                          )}
                        </div>
                      )}

                      {/* 배치 중 (미정산) */}
                      {hasPrediction && !isSettled && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-orange-500 text-xs">
                            {getDisplayName(
                              (pred!.team as any) || (pred!.predictedWinner as any)
                            )}{' '}
                            {pred!.battingOrder}번 타자 배치
                          </span>
                          {!isLocked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel(game.gameId);
                              }}
                              className="text-xs text-red-400 underline"
                            >
                              취소
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ===== 배치 UI (확장) ===== */}
                    {isExpanded &&
                      !isCancelled &&
                      !isSettled &&
                      !isLocked &&
                      !isBlocked && (
                        <div className="bg-white border-t border-gray-100 p-4 space-y-4">
                          {/* 팀 선택 */}
                          <div>
                            <p className="text-gray-400 text-xs mb-2">
                              응원할 팀을 선택하세요
                            </p>
                            <div className="flex gap-3">
                              {[game.awayTeam, game.homeTeam].map((t) => (
                                <button
                                  key={t}
                                  onClick={() =>
                                    updateSelection(game.gameId, {
                                      team: t,
                                      battingOrder: null,
                                    })
                                  }
                                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
                                    sel?.team === t
                                      ? 'bg-orange-400 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {getDisplayName(t as any)}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 타순 선택 */}
                          {sel?.team && (
                            <div>
                              <p className="text-gray-400 text-xs mb-2">
                                타순을 선택하세요 (1~9번)
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((order) => (
                                  <button
                                    key={order}
                                    onClick={() =>
                                      updateSelection(game.gameId, {
                                        battingOrder: order,
                                      })
                                    }
                                    className={`py-3 rounded-xl font-bold text-sm transition ${
                                      sel?.battingOrder === order
                                        ? 'bg-yellow-400 text-gray-900 shadow-md'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {order}번
                                  </button>
                                ))}
                              </div>
                              <p className="text-gray-300 text-[11px] mt-2 text-center">
                                경기 종료 후 해당 타자의 실제 성적으로 XP가
                                계산됩니다
                              </p>
                            </div>
                          )}

                          {/* 제출 버튼 */}
                          <button
                            onClick={() => handleSubmit(game.gameId)}
                            disabled={
                              submitting || !sel?.team || !sel?.battingOrder
                            }
                            className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 shadow-md active:scale-[0.98] transition"
                          >
                            {submitting
                              ? '처리 중...'
                              : hasPrediction
                              ? '배치 수정'
                              : '배치 확정'}
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
      {tab === 'history' &&
        (historyLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">총 획득</p>
                <p
                  className={`text-xl font-bold ${
                    historyTotalNetXp >= 0 ? 'text-orange-500' : 'text-red-400'
                  }`}
                >
                  {historyTotalNetXp >= 0 ? '+' : ''}
                  {historyTotalNetXp} XP
                </p>
              </div>
              <div className="flex-1 bg-emerald-50 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">적중</p>
                <p className="text-emerald-500 text-xl font-bold">
                  {historyCorrectCount}/{historySettled.length}
                </p>
              </div>
              <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">적중률</p>
                <p className="text-blue-500 text-xl font-bold">
                  {historyAccuracy}%
                </p>
              </div>
            </div>

            {dateGroups.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 mb-4">아직 배치 기록이 없습니다</p>
                <button
                  onClick={() => handleTabChange('today')}
                  className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
                >
                  경기 배치하러 가기
                </button>
              </div>
            ) : (
              dateGroups.map(([date, preds]) => {
                const isOpen =
                  expandedDate === date ||
                  (expandedDate === null && date === dateGroups[0]?.[0]);
                const settled = preds.filter(
                  (p) => p.status === 'settled' && p.result
                );
                const netXp = settled.reduce(
                  (s, p) => s + (p.result?.netXp || 0),
                  0
                );
                const correct = settled.filter(
                  (p) => p.result?.winCorrect
                ).length;
                const [y, m, d] = date.split('-').map(Number);
                const dayName = weekdays[new Date(y, m - 1, d).getDay()];

                return (
                  <div
                    key={date}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedDate(isOpen ? '__close__' : date)
                      }
                      className="w-full px-4 py-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 font-bold">
                          {m}월 {d}일 ({dayName})
                        </span>
                        {settled.length > 0 && (
                          <span className="text-xs text-gray-400">
                            {correct === settled.length ? '✅' : `적중 ${correct}/${settled.length}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {settled.length > 0 ? (
                          <span
                            className={`text-sm font-bold ${
                              netXp >= 0 ? 'text-emerald-500' : 'text-red-400'
                            }`}
                          >
                            {netXp >= 0 ? '+' : ''}
                            {netXp} XP
                          </span>
                        ) : (
                          <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                            대기중
                          </span>
                        )}
                        <span
                          className={`text-gray-400 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        >
                          ▼
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-50 px-3 pb-3 space-y-2">
                        {preds.map((p) => {
                          const pSettled = p.status === 'settled';
                          const pNetXp = p.result?.netXp || 0;
                          const isDetail = expandedId === p._id;
                          const matchLabel = p.game
                            ? `${getDisplayName(p.game.awayTeam as any)} vs ${getDisplayName(p.game.homeTeam as any)}`
                            : p.gameId;

                          return (
                            <div
                              key={p._id}
                              className="bg-gray-50 rounded-xl overflow-hidden"
                            >
                              <div className="p-3">
                                <div className="flex justify-between items-center mb-1">
                                  <p className="font-semibold text-gray-900 text-sm">
                                    {matchLabel}
                                  </p>
                                  {pSettled && (
                                    <span
                                      className={`text-sm font-bold ${
                                        pNetXp >= 0
                                          ? 'text-emerald-500'
                                          : 'text-red-400'
                                      }`}
                                    >
                                      {pNetXp >= 0 ? '+' : ''}
                                      {pNetXp}
                                    </span>
                                  )}
                                  {!pSettled && (
                                    <span className="text-xs text-yellow-600">
                                      대기중
                                    </span>
                                  )}
                                </div>

                                {p.game?.status === 'finished' && (
                                  <p className="text-gray-400 text-xs mb-1">
                                    {p.game.awayScore} : {p.game.homeScore}
                                  </p>
                                )}

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                                    {getDisplayName(
                                      (p.team || p.predictedWinner) as any
                                    )}{' '}
                                    {p.battingOrder
                                      ? `${p.battingOrder}번 타자`
                                      : '승'}
                                    {pSettled &&
                                      p.result &&
                                      (p.result.winCorrect ? ' ✅' : ' ❌')}
                                  </span>
                                  {p.result?.batterResult?.playerName && (
                                    <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                                      {p.result.batterResult.playerName}
                                    </span>
                                  )}
                                </div>

                                {pSettled && p.result && (
                                  <button
                                    onClick={() =>
                                      setExpandedId(isDetail ? null : p._id)
                                    }
                                    className="text-xs text-gray-400 underline mt-2"
                                  >
                                    {isDetail ? '접기' : '상세'}
                                  </button>
                                )}
                              </div>

                              {isDetail && pSettled && p.result && (
                                <div className="border-t border-gray-200 px-3 py-2 bg-white space-y-1.5 text-xs">
                                  {p.result.batterResult?.playerName && (
                                    <div className="pb-1.5 border-b border-gray-100">
                                      <p className="text-gray-700 font-bold mb-1">
                                        {p.result.batterResult.playerName} 성적
                                      </p>
                                      <p className="text-gray-500">
                                        {p.result.batterResult.atBats}타수{' '}
                                        {p.result.batterResult.hits}안타
                                        {(p.result.batterResult.doubles || 0) >
                                          0 &&
                                          ` · 2루타 ${p.result.batterResult.doubles}`}
                                        {(p.result.batterResult.triples || 0) >
                                          0 &&
                                          ` · 3루타 ${p.result.batterResult.triples}`}
                                        {(p.result.batterResult.homeRuns || 0) >
                                          0 &&
                                          ` · 홈런 ${p.result.batterResult.homeRuns}`}
                                        {(p.result.batterResult.rbi || 0) > 0 &&
                                          ` · ${p.result.batterResult.rbi}타점`}
                                        {(p.result.batterResult.runs || 0) >
                                          0 &&
                                          ` · ${p.result.batterResult.runs}득점`}
                                        {(p.result.batterResult.stolenBases ||
                                          0) > 0 &&
                                          ` · ${p.result.batterResult.stolenBases}도루`}
                                      </p>
                                    </div>
                                  )}

                                  {p.result.xpFromPlayer !== undefined && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">
                                        타자 성적 XP
                                      </span>
                                      <span
                                        className={
                                          p.result.xpFromPlayer >= 0
                                            ? 'text-emerald-500'
                                            : 'text-red-400'
                                        }
                                      >
                                        {p.result.xpFromPlayer >= 0 ? '+' : ''}
                                        {p.result.xpFromPlayer}
                                      </span>
                                    </div>
                                  )}
                                  {p.result.xpFromTeamWin !== undefined && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">
                                        팀 승리 XP
                                      </span>
                                      <span
                                        className={
                                          p.result.xpFromTeamWin > 0
                                            ? 'text-emerald-500'
                                            : 'text-gray-400'
                                        }
                                      >
                                        {p.result.xpFromTeamWin > 0
                                          ? `+${p.result.xpFromTeamWin}`
                                          : '0'}
                                      </span>
                                    </div>
                                  )}
                                  {p.result.xpFromWinPredict !== undefined && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">
                                        승리 예측 XP
                                      </span>
                                      <span
                                        className={
                                          p.result.xpFromWinPredict > 0
                                            ? 'text-emerald-500'
                                            : p.result.xpFromWinPredict < 0
                                            ? 'text-red-400'
                                            : 'text-gray-400'
                                        }
                                      >
                                        {p.result.xpFromWinPredict >= 0
                                          ? `+${p.result.xpFromWinPredict}`
                                          : p.result.xpFromWinPredict}
                                      </span>
                                    </div>
                                  )}

                                  <div className="pt-1.5 border-t border-gray-100 flex justify-between font-bold">
                                    <span className="text-gray-700">합계</span>
                                    <span
                                      className={
                                        pNetXp >= 0
                                          ? 'text-emerald-500'
                                          : 'text-red-400'
                                      }
                                    >
                                      {pNetXp >= 0 ? '+' : ''}
                                      {pNetXp} XP
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
        ))}
    </div>
  );
}
