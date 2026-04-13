'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BatterRecord {
  order: string;
  position: string;
  name: string;
  atBats: string;
  hits: string;
  rbi: string;
  runs: string;
  avg: string;
}

interface Game {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  startTime?: string;
  homeScore?: number;
  awayScore?: number;
  batterRecords?: {
    away: BatterRecord[];
    home: BatterRecord[];
  };
}

interface Selection {
  gameId: string;
  predictedWinner: string;
  selectedTeam: string;
  selectedOrder: number;
}

type TutorialStep = 'intro' | 'pick' | 'result';

export default function TutorialPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<TutorialStep>('intro');
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tutorialXp: number;
    actualXp: number;
    placement: any;
  } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (!token) return;
    fetchTutorialGames();
  }, [token, authStatus]);

  async function fetchTutorialGames() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/placements/tutorial/games`, { headers });
      if (res.ok) {
        setGames(await res.json());
      } else {
        const err = await res.json();
        if (err.error === '이미 튜토리얼을 완료했습니다') {
          router.push('/');
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function handleExpand(gameId: string) {
    setExpandedGame(expandedGame === gameId ? null : gameId);
  }

  function handlePrediction(gameId: string, team: string) {
    setSelection((prev) => ({
      gameId,
      predictedWinner: team,
      selectedTeam: prev?.gameId === gameId ? prev.selectedTeam : '',
      selectedOrder: prev?.gameId === gameId ? prev.selectedOrder : 0,
    }));
  }

  function handleBattingOrder(gameId: string, team: string, order: number) {
    setSelection((prev) => ({
      gameId,
      predictedWinner: prev?.gameId === gameId ? prev.predictedWinner : '',
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
      const res = await fetch(`${apiUrl}/api/placements/tutorial`, {
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
        const data = await res.json();
        setResult(data);
        setStep('result');
      } else {
        const err = await res.json();
        setToast(err.error || '튜토리얼 처리 실패');
        setTimeout(() => setToast(null), 2000);
      }
    } catch (e) {
      setToast('서버 오류');
      setTimeout(() => setToast(null), 2000);
    }
    setSubmitting(false);
  }

  if (loading || authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── 인트로 화면 ──
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">⚾</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">배치를 연습해볼까요?</h1>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-2">
          최근 완료된 실제 KBO 경기로<br />
          배치가 어떻게 진행되는지 체험해보세요.
        </p>
        <p className="text-xs text-gray-400 text-center mb-8">
          팀과 타순을 선택하면 즉시 결과를 확인할 수 있어요!
        </p>
        <button
          onClick={() => setStep('pick')}
          className="w-full max-w-xs bg-orange-400 text-white py-3.5 rounded-2xl font-bold shadow-md transition active:scale-[0.98]"
        >
          연습 배치 시작
        </button>
      </div>
    );
  }

  // ── 결과 화면 ──
  if (step === 'result' && result) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">튜토리얼 완료!</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-6 mb-4">
          <div className="text-center mb-4">
            <p className="text-gray-400 text-xs mb-1">실제 정산이었다면</p>
            <p className="text-2xl font-bold text-gray-300 line-through">
              {result.actualXp > 0 ? '+' : ''}{result.actualXp} XP
            </p>
          </div>
          <div className="text-center mb-4">
            <p className="text-gray-400 text-xs mb-1">튜토리얼 보상</p>
            <p className="text-3xl font-bold text-orange-500">+{result.tutorialXp} XP</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              매일 실제 경기에 배치하면<br />
              이렇게 XP를 획득할 수 있어요!<br />
              내 배치에서 상세 기록을 확인해보세요.
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          className="w-full max-w-sm bg-orange-400 text-white py-3.5 rounded-2xl font-bold shadow-md transition active:scale-[0.98]"
        >
          시작하기
        </button>
      </div>
    );
  }

  // ── 배치 선택 화면 (실제 match 페이지와 동일한 UI) ──
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
        <p className="text-blue-600 text-sm font-bold">연습 배치</p>
        <p className="text-blue-400 text-xs mt-1">
          이미 종료된 경기입니다. 자유롭게 선택해보세요!
        </p>
      </div>

      <h1 className="text-gray-900 text-lg font-bold mb-1">
        {games.length > 0 ? games[0].date : ''}
      </h1>
      <p className="text-gray-400 text-sm mb-4">{games.length}경기</p>

      {games.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">완료된 경기가 없습니다</p>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
          >
            메인으로
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const isExpanded = expandedGame === game.gameId;
            const isSelected = selection?.gameId === game.gameId;

            return (
              <div
                key={game.gameId}
                className={`rounded-2xl overflow-hidden transition-all shadow-sm ${
                  isSelected ? 'ring-2 ring-orange-400' : ''
                }`}
              >
                <div
                  onClick={() => handleExpand(game.gameId)}
                  className="bg-white p-4 border border-gray-100 cursor-pointer active:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex-1 text-center text-gray-800">
                      {game.awayTeam}
                    </span>
                    <span className="text-gray-400 text-sm mx-3 font-medium">
                      {game.awayScore} : {game.homeScore}
                    </span>
                    <span className="font-medium flex-1 text-center text-gray-800">
                      {game.homeTeam}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs text-center mt-1">경기 종료</p>
                  {isSelected && !isExpanded && selection && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
                      <span className="text-orange-500 text-xs">{selection.predictedWinner} 승리</span>
                      <span className="text-orange-500 text-xs">{selection.selectedTeam} {selection.selectedOrder}번 타자</span>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="bg-white border-t border-gray-100 p-4 space-y-4">
                    <div>
                      <p className="text-gray-400 text-xs mb-2">승리 예측</p>
                      <div className="flex gap-3">
                        {[game.awayTeam, game.homeTeam].map((t) => (
                          <button
                            key={t}
                            onClick={() => handlePrediction(game.gameId, t)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                              selection?.predictedWinner === t
                                ? 'bg-orange-400 text-white shadow-md'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {[
                      { label: game.awayTeam, team: game.awayTeam },
                      { label: game.homeTeam, team: game.homeTeam },
                    ].map(({ label, team }) => (
                      <div key={team}>
                        <p className="text-gray-400 text-xs mb-2">{label} 타순</p>
                        <div className="grid grid-cols-9 gap-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                            <button
                              key={`${team}-${n}`}
                              onClick={() => handleBattingOrder(game.gameId, team, n)}
                              className={`py-2 rounded-xl text-xs font-medium transition ${
                                selection?.selectedTeam === team && selection?.selectedOrder === n
                                  ? 'bg-orange-400 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleSubmit}
                      disabled={
                        submitting ||
                        selection?.gameId !== game.gameId ||
                        !selection?.predictedWinner ||
                        !selection?.selectedOrder
                      }
                      className="w-full bg-orange-400 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 transition shadow-md"
                    >
                      {submitting ? '정산 중...' : '선택 확정'}
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
