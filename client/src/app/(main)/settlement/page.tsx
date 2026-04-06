'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettlementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchResults();
  }, [token, status]);

  async function fetchResults() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/placements/history`, { headers });
      if (res.ok) {
        const data = await res.json();
        setResults(data.filter((p: any) => p.status === 'settled'));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalXp = results.reduce((sum, r) => sum + (r.xpFromPlayer || 0) + (r.xpFromPrediction || 0), 0);
  const correctCount = results.filter((r) => r.isCorrect).length;
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
        <h1 className="text-gray-900 text-lg font-bold mb-4">정산 결과</h1>
        <div className="flex gap-3">
          <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">총 획득 XP</p>
            <p className="text-orange-500 text-2xl font-bold">{totalXp}</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">승리 예측</p>
            <p className="text-emerald-500 text-2xl font-bold">{correctCount}/{results.length}</p>
          </div>
          <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">적중률</p>
            <p className="text-blue-500 text-2xl font-bold">{accuracy}%</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {results.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">아직 정산된 경기가 없습니다</p>
            <button
              onClick={() => router.push('/match')}
              className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
            >
              경기 배치하러 가기
            </button>
          </div>
        ) : (
          results.map((r: any, i: number) => {
            const totalXpItem = (r.xpFromPlayer || 0) + (r.xpFromPrediction || 0);
            const isPositive = totalXpItem >= 0;
            return (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-400 text-xs">{r.date}</span>
                  <span className={`text-lg font-bold ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{totalXpItem} XP
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
                    {r.team}
                  </span>
                  <span className="text-gray-600 text-sm">{r.battingOrder}번 타자</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
                    <p className="text-gray-400 text-[10px] mb-0.5">선수 성적</p>
                    <p className="text-gray-700 text-sm font-bold">
                      {(r.xpFromPlayer || 0) >= 0 ? '+' : ''}{r.xpFromPlayer || 0}
                    </p>
                  </div>
                  <div className={`flex-1 rounded-xl p-2.5 text-center ${r.isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className="text-gray-400 text-[10px] mb-0.5">승리 예측</p>
                    <p className={`text-sm font-bold ${r.isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>
                      {r.isCorrect ? '+30' : '0'}
                    </p>
                  </div>
                </div>
                {r.predictedWinner && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-xs ${r.isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>
                      {r.isCorrect ? '\u2713' : '\u2717'}
                    </span>
                    <span className="text-gray-400 text-xs">예측: {r.predictedWinner}</span>
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
