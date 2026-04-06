'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import XpBreakdownPopup from '@/components/XpBreakdownPopup';

interface Placement {
  _id: string;
  game: {
    awayTeam: string;
    homeTeam: string;
    date: string;
    status: string; // scheduled | in_progress | final
  };
  predictedWinner: string;
  selectedPlayer: string;
  battingOrder: number;
  settled: boolean;
  xpBreakdown?: Record<string, number>;
  totalXp?: number;
}

export default function MyPlacementsPage() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/placements/history').then((res) => setPlacements(res.data));
  }, []);

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">내 배치</h1>

      {placements.map((p) => (
        <div
          key={p._id}
          className="border rounded-xl p-4 mb-3 bg-white shadow-sm"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-500">{p.game.date}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                p.settled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {p.settled ? '정산완료' : '진행중'}
            </span>
          </div>

          <p className="font-semibold">
            {p.game.awayTeam} vs {p.game.homeTeam}
          </p>
          <p className="text-sm text-gray-600">
            {p.predictedWinner} 승리 예측 · {p.battingOrder}번 {p.selectedPlayer}
          </p>

          {/* 정산 완료: XP 표시 + 상세보기 */}
          {p.settled && p.totalXp !== undefined && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-blue-600 font-bold">
                +{p.totalXp} XP
              </span>
              <button
                onClick={() => setSelectedId(p._id)}
                className="text-xs text-gray-400 underline"
              >
                상세보기
              </button>
            </div>
          )}

          {/* 미정산: 수정 버튼 */}
          {!p.settled && p.game.status === 'scheduled' && (
            <div className="mt-2">
              <a
                href={`/games/${p.game.date}?edit=${p._id}`}
                className="text-xs text-blue-500 underline"
              >
                수정하기
              </a>
            </div>
          )}
        </div>
      ))}

      {/* XP 상세 팝업 */}
      {selectedId && (
        <XpBreakdownPopup
          placement={placements.find((p) => p._id === selectedId)!}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
