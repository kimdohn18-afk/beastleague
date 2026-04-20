'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDisplayName } from '@beastleague/shared';

interface PredictionResult {
  winCorrect: boolean;
  diffCorrect?: boolean;
  totalCorrect?: boolean;
  xpFromWin: number;
  xpFromDiff: number;
  xpFromTotal: number;
  xpLostDiff: number;
  xpLostTotal: number;
  netXp: number;
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
  result?: PredictionResult;
  game?: {
    homeTeam: string;
    awayTeam: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
  };
}

export default function MyPredictionsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
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
      const res = await fetch(`${apiUrl}/api/predictions/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPredictions(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const settled = predictions.filter(p => p.status === 'settled' && p.result);
  const totalNetXp = settled.reduce((s, p) => s + (p.result?.netXp || 0), 0);
  const correctCount = settled.filter(p => p.result?.winCorrect).length;
  const accuracy = settled.length > 0 ? Math.round((correctCount / settled.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 상단 요약 */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
        <h1 className="text-gray-900 text-lg font-bold mb-4">내 예측</h1>
        <div className="flex gap-3">
          <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">총 획득 XP</p>
            <p className={`text-2xl font-bold ${totalNetXp >= 0 ? 'text-orange-500' : 'text-red-400'}`}>
              {totalNetXp >= 0 ? '+' : ''}{totalNetXp}
            </p>
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

      {/* 예측 목록 */}
      <div className="p-4 space-y-3">
        {predictions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">아직 예측 기록이 없습니다</p>
            <button
              onClick={() => router.push('/match')}
              className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
            >
              경기 예측하러 가기
            </button>
          </div>
        ) : (
          predictions.map((p) => {
            const isSettled = p.status === 'settled';
            const isExpanded = expandedId === p._id;
            const netXp = p.result?.netXp || 0;
            const matchLabel = p.game
              ? `${getDisplayName(p.game.awayTeam as any)} vs ${getDisplayName(p.game.homeTeam as any)}`
              : p.gameId;

            return (
              <div key={p._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-xs">{p.date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isSettled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {isSettled ? '정산완료' : '진행중'}
                    </span>
                  </div>

                  <p className="font-semibold text-gray-900 mb-1">{matchLabel}</p>

                  {p.game?.status === 'finished' && (
                    <p className="text-gray-400 text-xs mb-1">
                      {p.game.awayScore} : {p.game.homeScore}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {getDisplayName(p.predictedWinner as any)} 승리
                    </span>
                    {p.scoreDiffRange && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        점수차 {p.scoreDiffRange} ({p.xpBetOnDiff} XP)
                      </span>
                    )}
                    {p.totalRunsRange && (
                      <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        총득점 {p.totalRunsRange} ({p.xpBetOnTotal} XP)
                      </span>
                    )}
                  </div>

                  {isSettled && p.result && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-lg font-bold ${netXp >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {netXp >= 0 ? '+' : ''}{netXp} XP
                      </span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p._id)}
                        className="text-xs text-gray-400 underline"
                      >
                        {isExpanded ? '접기' : '상세보기'}
                      </button>
                    </div>
                  )}
                </div>

                {/* 상세 패널 */}
                {isExpanded && isSettled && p.result && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">승리 예측</span>
                      <span className={p.result.winCorrect ? 'text-emerald-500 font-medium' : 'text-red-400'}>
                        {p.result.winCorrect ? `✅ 적중 +${p.result.xpFromWin}` : '❌ 실패 0'}
                      </span>
                    </div>

                    {p.result.diffCorrect !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">점수차 ({p.scoreDiffRange})</span>
                        <span className={p.result.diffCorrect ? 'text-emerald-500 font-medium' : 'text-red-400'}>
                          {p.result.diffCorrect
                            ? `✅ +${p.result.xpFromDiff}`
                            : `❌ -${p.result.xpLostDiff}`}
                        </span>
                      </div>
                    )}

                    {p.result.totalCorrect !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">총득점 ({p.totalRunsRange})</span>
                        <span className={p.result.totalCorrect ? 'text-emerald-500 font-medium' : 'text-red-400'}>
                          {p.result.totalCorrect
                            ? `✅ +${p.result.xpFromTotal}`
                            : `❌ -${p.result.xpLostTotal}`}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-200 flex justify-between font-bold">
                      <span className="text-gray-700">합계</span>
                      <span className={netXp >= 0 ? 'text-emerald-500' : 'text-red-400'}>
                        {netXp >= 0 ? '+' : ''}{netXp} XP
                      </span>
                    </div>
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
