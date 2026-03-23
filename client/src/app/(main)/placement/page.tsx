'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import GameCard from '@/components/GameCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import type { GameData, TeamCode, BatterGroupType } from '@beastleague/shared';

const GROUP_INFO: Record<string, { label: string; hint: string; emoji: string }> = {
  leadoff:          { label: '상위타선', hint: '1~2번 | Skill·Mind', emoji: '🎯' },
  cleanup:          { label: '클린업',   hint: '3~5번 | Power',      emoji: '💥' },
  lower:            { label: '하위타선', hint: '6~9번 | Agility',    emoji: '⚡' },
  starter_pitcher:  { label: '선발투수', hint: '투수 | Stamina',     emoji: '⚾' },
};

function todayDate() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function PlacementPage() {
  const router = useRouter();
  const toast = useToast();
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<{ game?: GameData; team?: TeamCode; groupType?: BatterGroupType }>({});
  const [popularity, setPopularity] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<GameData[]>(`/api/games?date=${todayDate()}`)
      .then((r) => setGames(r.data))
      .catch(() => setGames([]))
      .finally(() => setLoading(false));
  }, []);

  const loadPopularity = async (gameId: string) => {
    try {
      const res = await api.get<Array<{ _id: { team: string; groupType: string }; count: number }>>(
        `/api/games/${gameId}/popularity`
      );
      const map: Record<string, number> = {};
      res.data.forEach((r) => { map[`${r._id.team}-${r._id.groupType}`] = r.count; });
      setPopularity(map);
    } catch { /* ignore */ }
  };

  const handleSelectGame = (game: GameData) => {
    setSelected({ game });
    loadPopularity(game.gameId);
    setStep(1);
  };

  const handleSelectTeam = (team: TeamCode) => {
    setSelected((s) => ({ ...s, team }));
    setStep(2);
  };

  const handleSelectGroup = (groupType: BatterGroupType) => {
    setSelected((s) => ({ ...s, groupType }));
    setStep(3);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/placements', {
        gameId: selected.game!.gameId,
        team: selected.team,
        groupType: selected.groupType,
      });
      toast('배치 완료! 오늘 경기를 응원하세요 ⚾', 'success');
      router.push('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '배치 실패';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner /></div>;

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      {/* 스텝 인디케이터 */}
      <div className="flex gap-2 mb-6">
        {['경기', '팀', '그룹', '확인'].map((label, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-primary' : 'bg-surfaceLight'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0: 경기 선택 */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 className="font-bold text-lg mb-4">오늘 경기 선택</h2>
            {games.length === 0
              ? <EmptyState emoji="📅" title="오늘 예정된 경기가 없습니다" />
              : <div className="space-y-3">
                  {games.map((g) => (
                    <GameCard key={g.gameId} {...g} onClick={() => handleSelectGame(g)} />
                  ))}
                </div>
            }
          </motion.div>
        )}

        {/* Step 1: 팀 선택 */}
        {step === 1 && selected.game && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setStep(0)} className="text-textSecondary text-sm mb-4">← 경기 다시 선택</button>
            <h2 className="font-bold text-lg mb-4">팀 선택</h2>
            <div className="grid grid-cols-2 gap-3">
              {([selected.game.awayTeam, selected.game.homeTeam] as TeamCode[]).map((team) => (
                <button
                  key={team}
                  onClick={() => handleSelectTeam(team)}
                  className="p-5 rounded-2xl border border-white/10 bg-surfaceLight hover:border-primary font-bold text-lg active:scale-95 transition-all"
                >
                  {team}
                  <p className="text-xs text-textSecondary font-normal mt-1">
                    {popularity[`${team}-leadoff`] !== undefined
                      ? `${Object.entries(popularity).filter(([k]) => k.startsWith(team)).reduce((a, [, v]) => a + v, 0)}명 배치`
                      : ''}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: 그룹 선택 */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setStep(1)} className="text-textSecondary text-sm mb-4">← 팀 다시 선택</button>
            <h2 className="font-bold text-lg mb-4">타순 그룹 선택</h2>
            <div className="space-y-3">
              {(Object.entries(GROUP_INFO) as [BatterGroupType, typeof GROUP_INFO[string]][]).map(([type, info]) => {
                const key = `${selected.team}-${type}`;
                const count = popularity[key] ?? 0;
                return (
                  <button
                    key={type}
                    onClick={() => handleSelectGroup(type)}
                    className="w-full p-4 rounded-xl border border-white/10 bg-surfaceLight hover:border-primary flex items-center gap-3 text-left active:scale-95 transition-all"
                  >
                    <span className="text-3xl">{info.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold">{info.label}</p>
                      <p className="text-xs text-textSecondary">{info.hint}</p>
                    </div>
                    {count > 0 && <span className="text-xs text-accent">{count}명</span>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 3: 확인 */}
        {step === 3 && selected.game && selected.team && selected.groupType && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setStep(2)} className="text-textSecondary text-sm mb-4">← 그룹 다시 선택</button>
            <div className="bg-surfaceLight rounded-2xl p-5 border border-white/10 mb-5">
              <p className="text-textSecondary text-sm mb-3">배치 확인</p>
              <p className="text-2xl font-black mb-1">
                {selected.team} {GROUP_INFO[selected.groupType]?.label}
              </p>
              <p className="text-textSecondary text-sm">{selected.game.awayTeam} vs {selected.game.homeTeam}</p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full py-4 bg-primary rounded-xl font-bold text-white disabled:opacity-50"
            >
              {submitting ? '배치 중...' : '배치 확정 ⚾'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
