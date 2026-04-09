'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { requestFcmToken } from '@/lib/firebase';

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

interface Selection {
  gameId: string;
  predictedWinner: string;
  selectedTeam: string;
  selectedOrder: number;
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
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [placementLocked, setPlacementLocked] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const todayKST = () => {
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    return now.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!token) return;
    fetchGames();
    fetchMyPlacement();
  }, [token]);

  async function fetchGames() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/games?date=${todayKST()}`, { headers });
      if (res.ok) setGames(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchMyPlacement() {
    try {
      const res = await fetch(`${apiUrl}/api/placements/today`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSelection({
            gameId: data.gameId,
            predictedWinner: data.predictedWinner || '',
            selectedTeam: data.team,
            selectedOrder: data.battingOrder || 0,
          });
          if (data.status === 'settled') setPlacementLocked(true);
        }
      }
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (selection && games.length > 0) {
      const placedGame = games.find(g => g.gameId === selection.gameId);
      if (placedGame && isGameStartedByTime(placedGame)) {
        setPlacementLocked(true);
      }
    }
  }, [selection, games]);

  function handleExpand(gameId: string) {
    if (placementLocked) return;
    setExpandedGame(expandedGame === gameId ? null : gameId);
  }

  function handlePrediction(gameId: string, team: string) {
    if (placementLocked) return;
    setSelection((prev) => ({
      gameId,
      predictedWinner: team,
      selectedTeam: prev?.selectedTeam || '',
      selectedOrder: prev?.selectedOrder || 0,
    }));
  }

  function handleBattingOrder(gameId: string, team: string, order: number) {
    if (placementLocked) return;
    setSelection((prev) => ({
      gameId,
      predictedWinner: prev?.predictedWinner || '',
      selectedTeam: team,
      selectedOrder: order,
    }));
  }

  async function shouldShowPushPrompt(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    const dismissedDate = localStorage.getItem('push-prompt-dismissed');
    if (dismissedDate === todayKST()) return false;
    if (Notification.permission === 'default') return true;
    try {
      const res = await fetch(`${apiUrl}/api/push/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return !data.subscribed;
      }
    } catch {}
    return false;
  }

  async function handlePushAccept() {
    setPushLoading(true);
    try {
      const fcmToken = await requestFcmToken();
      if (fcmToken) {
        await fetch(`${apiUrl}/api/push/subscribe`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ fcmToken }),
        });
        setToast('알림이 설정되었습니다!');
      } else {
        setToast('알림 권한이 차단되었습니다');
      }
    } catch {
      setToast('알림 설정 중 오류가 발생했습니다');
    }
    setPushLoading(false);
    setShowPushPrompt(false);
    setTimeout(() => setToast(null), 2000);
  }

  function handlePushDismiss() {
    localStorage.setItem('push-prompt-dismissed', todayKST());
    setShowPushPrompt(false);
  }

  async function handleSubmit() {
    if (placementLocked) {
      setToast('이미 시작된 경기의 배치는 수정할 수 없습니다');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    if (!selection || !selection.predictedWinner || !selection.selectedOrder) {
      setToast('승패 예측과 타순을 모두 선택해주세요');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/placements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          gameId: selection.gameId,
          team: selection.selectedTeam,
          battingOrder: selection.selectedOrder,
          predictedWinner: selection.predictedWinner,
        }),
      });
      if (res.ok) {
        setToast('선택 완료!');
        setExpandedGame(null);
        const shouldShow = await shouldShowPushPrompt();
        if (shouldShow) {
          setTimeout(() => setShowPushPrompt(true), 500);
        }
      } else {
        const err = await res.json();
        setToast(err.error || '선택 실패');
      }
    } catch (e) { setToast('서버 오류'); }
    setSubmitting(false);
    setTimeout(() => setToast(null), 2000);
  }

  // 취소되지 않은 경기가 있는지 확인
  const activeGames = games.filter(g => g.status !== 'cancelled');
  const cancelledGames = games.filter(g => g.status === 'cancelled');
  const allCancelled = games.length > 0 && activeGames.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-gray-900 text-lg font-bold mb-1">{todayKST()}</h1>
      <p className="text-gray-400 text-sm mb-4">
        {games.length}경기
        {cancelledGames.length > 0 && (
          <span className="text-red-400 ml-1">
            (취소 {cancelledGames.length}경기)
          </span>
        )}
      </p>

      {allCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-center">
          <p className="text-2xl mb-2">🌧️</p>
          <p className="text-red-500 text-sm font-bold">오늘 경기가 모두 취소되었습니다</p>
          <p className="text-red-400 text-xs mt-1">우천 등의 사유로 경기가 진행되지 않습니다</p>
        </div>
      )}

      {placementLocked && selection && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
          <p className="text-orange-600 text-sm font-bold">오늘의 배치가 확정되었습니다</p>
          <p className="text-orange-400 text-xs mt-1">
            경기가 시작되어 수정할 수 없습니다 · {selection.selectedTeam} {selection.selectedOrder}번 타자 · {selection.predictedWinner} 승리 예측
          </p>
        </div>
      )}

      {games.length === 0 ? (
        <p className="text-gray-400 text-center mt-20">오늘 경기가 없습니다</p>
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const isCancelled = game.status === 'cancelled';
            const isExpanded = expandedGame === game.gameId;
            const isSelected = selection?.gameId === game.gameId;
            const isGameLocked = isGameStartedByTime(game);
            const cannotModify = placementLocked || isGameLocked || isCancelled;

            return (
              <div
                key={game.gameId}
                className={`rounded-2xl overflow-hidden transition-all shadow-sm ${
                  isCancelled ? 'opacity-50' : isSelected ? 'ring-2 ring-orange-400' : ''
                }`}
              >
                <div
                  onClick={() => !cannotModify && handleExpand(game.gameId)}
                  className={`bg-white p-4 border border-gray-100 ${
                    cannotModify ? 'opacity-60' : 'cursor-pointer active:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium flex-1 text-center ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {game.awayTeam}
                    </span>
                    <span className="text-gray-300 text-sm mx-3">
                      {isCancelled
                        ? '취소'
                        : game.status === 'finished'
                          ? `${game.awayScore} : ${game.homeScore}`
                          : isGameLocked
                            ? '경기 중'
                            : game.startTime
                              ? `${game.startTime}`
                              : 'vs'}
                    </span>
                    <span className={`font-medium flex-1 text-center ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {game.homeTeam}
                    </span>
                  </div>
                  {isSelected && !isExpanded && selection && !isCancelled && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
                      <span className="text-orange-500 text-xs">{selection.predictedWinner} 승리</span>
                      <span className="text-orange-500 text-xs">{selection.selectedTeam} {selection.selectedOrder}번 타자</span>
                    </div>
                  )}
                  {isCancelled && (
                    <p className="text-red-400 text-xs text-center mt-1">🌧️ 우천취소</p>
                  )}
                  {!isCancelled && isGameLocked && game.status !== 'finished' && (
                    <p className="text-gray-400 text-xs text-center mt-1">경기 시작됨</p>
                  )}
                  {game.status === 'finished' && (
                    <p className="text-gray-400 text-xs text-center mt-1">경기 종료</p>
                  )}
                </div>

                {isExpanded && !cannotModify && (
                  <div className="bg-white border-t border-gray-100 p-4 space-y-4">
                    <div>
                      <p className="text-gray-400 text-xs mb-2">승리 예측</p>
                      <div className="flex gap-3">
                        {[game.awayTeam, game.homeTeam].map((t) => (
                          <button
                            key={t}
                            onClick={() => handlePrediction(game.gameId, t)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                              selection?.predictedWinner === t ? 'bg-orange-400 text-white shadow-md' : 'bg-gray-100 text-gray-500'
                            }`}
                          >{t}</button>
                        ))}
                      </div>
                    </div>

                    {[{ label: game.awayTeam, team: game.awayTeam }, { label: game.homeTeam, team: game.homeTeam }].map(({ label, team }) => (
                      <div key={team}>
                        <p className="text-gray-400 text-xs mb-2">{label} 타순</p>
                        <div className="grid grid-cols-9 gap-1">
                          {[1,2,3,4,5,6,7,8,9].map((n) => (
                            <button
                              key={`${team}-${n}`}
                              onClick={() => handleBattingOrder(game.gameId, team, n)}
                              className={`py-2 rounded-xl text-xs font-medium transition ${
                                selection?.selectedTeam === team && selection?.selectedOrder === n
                                  ? 'bg-orange-400 text-white shadow-md' : 'bg-gray-100 text-gray-500'
                              }`}
                            >{n}</button>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !selection?.predictedWinner || !selection?.selectedOrder}
                      className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 transition shadow-md"
                    >
                      {submitting ? '저장 중...' : '선택 확정'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showPushPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handlePushDismiss}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-3">🔔</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">배치 완료!</h2>
            <p className="text-sm text-gray-500 mb-1">경기 결과가 나오면 알림으로 알려드릴까요?</p>
            <p className="text-xs text-gray-400 mb-6">정산 결과와 XP 획득 알림을 받을 수 있어요</p>
            <div className="flex gap-3">
              <button
                onClick={handlePushDismiss}
                className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                다음에
              </button>
              <button
                onClick={handlePushAccept}
                disabled={pushLoading}
                className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500 disabled:opacity-50"
              >
                {pushLoading ? '설정 중...' : '알림 받기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
