'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface Game {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
}

interface Selection {
  gameId: string;
  predictedWinner: string;
  selectedTeam: string;
  selectedOrder: number;
}

export default function MatchPage() {
  const { data: session } = useSession();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
        }
      }
    } catch (e) { console.error(e); }
  }

  function handleExpand(gameId: string) {
    setExpandedGame(expandedGame === gameId ? null : gameId);
  }

  function handlePrediction(gameId: string, team: string) {
    setSelection((prev) => ({
      gameId,
      predictedWinner: team,
      selectedTeam: prev?.selectedTeam || '',
      selectedOrder: prev?.selectedOrder || 0,
    }));
  }

  function handleBattingOrder(gameId: string, team: string, order: number) {
    setSelection((prev) => ({
      gameId,
      predictedWinner: prev?.predictedWinner || '',
      selectedTeam: team,
      selectedOrder: order,
    }));
  }

  async function handleSubmit() {
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
      } else {
        const err = await res.json();
        setToast(err.error || '선택 실패');
      }
    } catch (e) {
      setToast('서버 오류');
    }
    setSubmitting(false);
    setTimeout(() => setToast(null), 2000);
  }

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
      <p className="text-gray-400 text-sm mb-4">{games.length}경기</p>

      {games.length === 0 ? (
        <p className="text-gray-400 text-center mt-20">오늘 경기가 없습니다</p>
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const isExpanded = expandedGame === game.gameId;
            const isSelected = selection?.gameId === game.gameId;
            const isFinished = game.status === 'finished';
            const isLive = game.status === 'live';
            const isLocked = isFinished || isLive;

            return (
              <div
                key={game.gameId}
                className={`rounded-2xl overflow-hidden transition-all shadow-sm ${
                  isSelected ? 'ring-2 ring-orange-400' : ''
                }`}
              >
                {/* 접힌 카드 */}
                <div
                  onClick={() => !isLocked && handleExpand(game.gameId)}
                  className={`bg-white p-4 border border-gray-100 ${isLocked ? 'opacity-60' : 'cursor-pointer active:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-800 font-medium flex-1 text-center">{game.awayTeam}</span>
                    <span className="text-gray-300 text-sm mx-3">
                      {isFinished ? `${game.awayScore} : ${game.homeScore}` : 'vs'}
                    </span>
                    <span className="text-gray-800 font-medium flex-1 text-center">{game.homeTeam}</span>
                  </div>

                  {isSelected && !isExpanded && selection && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
                      <span className="text-orange-500 text-xs">
                        {selection.predictedWinner} 승리
                      </span>
                      <span className="text-orange-500 text-xs">
                        {selection.selectedTeam} {selection.selectedOrder}번 타자
                      </span>
                    </div>
                  )}

                  {isLocked && (
                    <p className="text-gray-400 text-xs text-center mt-1">
                      {isLive ? '경기 중' : '경기 종료'}
                    </p>
                  )}
                </div>

                {/* 펼쳐진 카드 */}
                {isExpanded && (
                  <div className="bg-white border-t border-gray-100 p-4 space-y-4">
                    {/* 승패 예측 */}
                    <div>
                      <p className="text-gray-400 text-xs mb-2">승리 예측</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handlePrediction(game.gameId, game.awayTeam)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                            selection?.predictedWinner === game.awayTeam
                              ? 'bg-orange-400 text-white shadow-md'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {game.awayTeam}
                        </button>
                        <button
                          onClick={() => handlePrediction(game.gameId, game.homeTeam)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                            selection?.predictedWinner === game.homeTeam
                              ? 'bg-orange-400 text-white shadow-md'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {game.homeTeam}
                        </button>
                      </div>
                    </div>

                    {/* 타순 선택 */}
                    <div>
                      <p className="text-gray-400 text-xs mb-2">{game.awayTeam} 타순</p>
                      <div className="grid grid-cols-9 gap-1">
                        {[1,2,3,4,5,6,7,8,9].map((n) => (
                          <button
                            key={`away-${n}`}
                            onClick={() => handleBattingOrder(game.gameId, game.awayTeam, n)}
                            className={`py-2 rounded-xl text-xs font-medium transition ${
                              selection?.selectedTeam === game.awayTeam && selection?.selectedOrder === n
                                ? 'bg-orange-400 text-white shadow-md'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-xs mb-2">{game.homeTeam} 타순</p>
                      <div className="grid grid-cols-9 gap-1">
                        {[1,2,3,4,5,6,7,8,9].map((n) => (
                          <button
                            key={`home-${n}`}
                            onClick={() => handleBattingOrder(game.gameId, game.homeTeam, n)}
                            className={`py-2 rounded-xl text-xs font-medium transition ${
                              selection?.selectedTeam === game.homeTeam && selection?.selectedOrder === n
                                ? 'bg-orange-400 text-white shadow-md'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 확정 버튼 */}
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
    </div>
  );
}
