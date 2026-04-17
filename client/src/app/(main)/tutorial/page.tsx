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

interface XpBreakdown {
  hits: number;
  rbi: number;
  runs: number;
  noHitPenalty: number;
  homeRun: number;
  double: number;
  triple: number;
  stolenBase: number;
  caughtStealing: number;
  walkOff: number;
  teamResult: number;
  total: number;
}

interface TutorialPlacement {
  _id: string;
  gameId: string;
  team: string;
  battingOrder: number;
  predictedWinner: string;
  date: string;
  status: string;
  isCorrect?: boolean;
  xpFromPlayer: number;
  xpFromPrediction: number;
  xpBreakdown?: XpBreakdown;
  game?: {
    homeTeam: string;
    awayTeam: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
    batterRecords?: {
      away: BatterRecord[];
      home: BatterRecord[];
    };
  };
}

const XP_LABELS: Record<string, string> = {
  hits: '안타',
  rbi: '타점',
  runs: '득점',
  homeRun: '홈런',
  double: '2루타',
  triple: '3루타',
  stolenBase: '도루',
  caughtStealing: '도루실패',
  noHitPenalty: '무안타',
  walkOff: '끝내기',
};

function getMyBatters(p: TutorialPlacement): BatterRecord[] {
  if (!p.game?.batterRecords) return [];
  const isHome = p.team === p.game.homeTeam;
  const batters = isHome ? p.game.batterRecords.home : p.game.batterRecords.away;
  if (!batters) return [];

  const orderStr = String(p.battingOrder);
  const result: BatterRecord[] = [];

  for (let i = 0; i < batters.length; i++) {
    if (batters[i].order === orderStr) {
      result.push(batters[i]);
      for (let j = i + 1; j < batters.length; j++) {
        if (batters[j].order === '') {
          result.push(batters[j]);
        } else {
          break;
        }
      }
      break;
    }
  }
  return result;
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
    placement: TutorialPlacement;
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
          router.push('/?tutorialXp=15');
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
    const p = result.placement;
    const myBatters = getMyBatters(p);
    const totalXpItem = p.xpFromPlayer + p.xpFromPrediction;
    const isPositive = totalXpItem >= 0;
    const predictionXp = (p.xpBreakdown?.teamResult ?? 0) + p.xpFromPrediction;
    const matchLabel = p.game
      ? `${p.game.awayTeam} ${p.game.awayScore} : ${p.game.homeScore} ${p.game.homeTeam}`
      : p.gameId;

    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-xl font-bold text-gray-800">튜토리얼 완료!</h1>
        </div>

        {/* 경기 결과 카드 — 내 배치와 동일한 구조 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-xs">{p.date}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                정산완료
              </span>
            </div>
            <p className="font-semibold text-gray-900 mb-1">{matchLabel}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
                {p.team}
              </span>
              <span className="text-gray-600 text-sm">{p.battingOrder}번 타자</span>
              <span className="text-gray-400 text-xs">· {p.predictedWinner} 승리 예측</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-lg font-bold ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{totalXpItem} XP
              </span>
            </div>
          </div>

          {/* 상세 내역 — 처음부터 펼쳐진 상태 */}
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
            {myBatters.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-2">선수 성적</p>
                {myBatters.map((b, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 mb-1 border border-gray-100">
                    <p className="text-sm font-bold text-gray-900 mb-1">
                      {i === 0 ? `${p.battingOrder}번 타자` : '교체 선수'}
                      <span className="text-xs text-gray-400 font-normal ml-2">{b.position}</span>
                    </p>
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span>{b.atBats}타수</span>
                      <span className="font-semibold text-gray-900">{b.hits}안타</span>
                      <span>{b.rbi}타점</span>
                      <span>{b.runs}득점</span>
                      <span>타율 {b.avg}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {p.xpBreakdown && (
              <div>
                <p className="text-xs text-gray-400 mb-2">XP 상세</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {Object.entries(XP_LABELS).map(([key, label]) => {
                    const val = (p.xpBreakdown as any)[key];
                    if (!val || val === 0) return null;
                    const isNeg = val < 0;
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-500">{label}</span>
                        <span className={`font-medium ${isNeg ? 'text-red-400' : 'text-gray-700'}`}>
                          {isNeg ? '' : '+'}{val}
                        </span>
                      </div>
                    );
                  })}
                  {predictionXp !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">승리 예측</span>
                      <span className="font-medium text-gray-700">+{predictionXp}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-bold">
                  <span className="text-gray-700">합계</span>
                  <span className={isPositive ? 'text-emerald-500' : 'text-red-400'}>
                    {isPositive ? '+' : ''}{totalXpItem} XP
                  </span>
                </div>
                {p.isCorrect !== undefined && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className={p.isCorrect ? 'text-emerald-500' : 'text-red-400'}>
                      {p.isCorrect ? '✓' : '✗'}
                    </span>
                    <span className="text-gray-400 text-xs">
                      예측: {p.predictedWinner} {p.isCorrect ? '적중!' : '실패'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 튜토리얼 XP 안내 */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-orange-600 text-sm font-bold">튜토리얼 보상</span>
            <span className="text-orange-500 text-lg font-bold">+{result.tutorialXp} XP</span>
          </div>
          <p className="text-orange-400 text-xs leading-relaxed">
            실제 배치였다면 {result.actualXp > 0 ? '+' : ''}{result.actualXp} XP를 받았을 거예요.
            매일 경기에 배치해서 캐릭터를 키워보세요!
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full bg-orange-400 text-white py-3.5 rounded-2xl font-bold shadow-md transition active:scale-[0.98]"
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
