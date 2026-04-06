'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Placement {
  _id: string;
  gameId: string;
  team: string;
  battingOrder: number;
  predictedWinner: string;
  date: string;
  status: 'pending' | 'active' | 'settled';
  isCorrect?: boolean;
  xpFromPlayer: number;
  xpFromPrediction: number;
  xpBreakdown?: {
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
  };
  game?: {
    homeTeam: string;
    awayTeam: string;
    status: string;
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
  teamResult: '팀 승리',
};

export default function MyPlacementsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchHistory();
  }, [token, authStatus]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/placements/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPlacements(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const settled = placements.filter((p) => p.status === 'settled');
  const totalXp = settled.reduce((s, p) => s + p.xpFromPlayer + p.xpFromPrediction, 0);
  const correctCount = settled.filter((p) => p.isCorrect).length;
  const accuracy = settled.length > 0 ? Math.round((correctCount / settled.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 상단 통계 */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
        <h1 className="text-gray-900 text-lg font-bold mb-4">내 배치</h1>
        <div className="flex gap-3">
          <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">총 획득 XP</p>
            <p className="text-orange-500 text-2xl font-bold">{totalXp}</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">승리 예측</p>
            <p className="text-emerald-500 text-2xl font-bold">{correctCount}/{settled.length}</p>
          </div>
          <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">적중률</p>
            <p className="text-blue-500 text-2xl font-bold">{accuracy}%</p>
          </div>
        </div>
      </div>

      {/* 배치 리스트 */}
      <div className="p-4 space-y-3">
        {placements.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">아직 배치 기록이 없습니다</p>
            <button
              onClick={() => router.push('/match')}
              className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
            >
              경기 배치하러 가기
            </button>
          </div>
        ) : (
          placements.map((p) => {
            const isSettled = p.status === 'settled';
            const totalXpItem = p.xpFromPlayer + p.xpFromPrediction;
            const isPositive = totalXpItem >= 0;
            const isExpanded = expandedId === p._id;
            const matchLabel = p.game
              ? `${p.game.awayTeam} vs ${p.game.homeTeam}`
              : p.gameId;

            return (
              <div key={p._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-xs">{p.date}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isSettled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {isSettled ? '정산완료' : '진행중'}
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

                  {isSettled && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-lg font-bold ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{totalXpItem} XP
                      </span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p._id)}
                        className="text-xs text-gray-400 underline"
                      >
                        {isExpanded ? '접기' : '상세보기'}
                      </button>
                    </div>
                  )}

                  {!isSettled && (
                    <button
                      onClick={() => router.push('/match')}
                      className="mt-3 text-xs text-blue-500 underline"
                    >
                      수정하기
                    </button>
                  )}
                </div>

                {/* XP 상세 (펼쳤을 때만) */}
                {isExpanded && isSettled && p.xpBreakdown && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
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
            );
          })
        )}
      </div>
    </div>
  );
}
