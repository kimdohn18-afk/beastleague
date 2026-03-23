'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Battle {
  _id: string;
  date: string;
  result: { player1: string; player2: string };
  xpAwarded: { player1: number; player2: number };
  player1: { userId: string; statGain: number };
  player2: { userId: string; statGain: number };
}

const RESULT_STYLE: Record<string, { label: string; color: string }> = {
  win:  { label: '승리 🎉', color: 'text-green-400' },
  lose: { label: '패배',     color: 'text-red-400'   },
  draw: { label: '무승부',   color: 'text-yellow-400' },
};

export default function BattlePage() {
  const [todayBattle, setTodayBattle] = useState<Battle | null>(null);
  const [history, setHistory] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Battle[]>('/api/battles/today').catch(() => ({ data: [] as Battle[] })),
      api.get<Battle[]>('/api/battles/history').catch(() => ({ data: [] as Battle[] })),
    ]).then(([today, hist]) => {
      setTodayBattle(today.data[0] ?? null);
      setHistory(hist.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner /></div>;

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto space-y-5">
      <h1 className="font-black text-xl">⚔️ 대결</h1>

      {/* 오늘 대결 */}
      {todayBattle ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surfaceLight rounded-2xl p-5 border border-white/10"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="text-center flex-1">
              <p className="text-2xl">🐾</p>
              <p className="text-sm font-semibold">나</p>
              <p className="text-xs text-textSecondary">획득 {todayBattle.player1.statGain.toFixed(1)}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-xl font-black">VS</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl">🐾</p>
              <p className="text-sm font-semibold">상대</p>
              <p className="text-xs text-textSecondary">획득 {todayBattle.player2.statGain.toFixed(1)}</p>
            </div>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${RESULT_STYLE[todayBattle.result.player1]?.color}`}>
              {RESULT_STYLE[todayBattle.result.player1]?.label}
            </p>
            <p className="text-xs text-textSecondary mt-1">XP +{todayBattle.xpAwarded.player1}</p>
          </div>
        </motion.div>
      ) : (
        <EmptyState emoji="⏳" title="오늘 대결이 없습니다" description="경기 종료 후 자동으로 매칭됩니다" />
      )}

      {/* 최근 대결 이력 */}
      {history.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-textSecondary mb-3">최근 대결</h3>
          <div className="space-y-2">
            {history.map((b) => (
              <div key={b._id} className="bg-surfaceLight rounded-xl p-3 border border-white/10 flex justify-between items-center">
                <span className="text-xs text-textSecondary">{b.date}</span>
                <span className={`text-sm font-bold ${RESULT_STYLE[b.result.player1]?.color}`}>
                  {RESULT_STYLE[b.result.player1]?.label}
                </span>
                <span className="text-xs text-accent">+{b.xpAwarded.player1} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
