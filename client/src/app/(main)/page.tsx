'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/Toast';
import CreateCharacterModal from '@/components/CreateCharacterModal';
import ProgressBar from '@/components/ProgressBar';
import EmptyState from '@/components/EmptyState';
import LoadingSpinner from '@/components/LoadingSpinner';
import api from '@/lib/api';
import type { Character, Training } from '@beastleague/shared';

const ANIMAL_EMOJI: Record<string, string> = {
  bear: '🐻', tiger: '🐯', eagle: '🦅', wolf: '🐺', dragon: '🐲',
};

const TRAINING_TYPES = [
  { type: 'batting',      emoji: '🏏', label: '배팅',    hint: 'P+0.3 S+0.2' },
  { type: 'fielding',     emoji: '🧤', label: '수비',    hint: 'S+0.3 A+0.2' },
  { type: 'running',      emoji: '🏃', label: '러닝',    hint: 'A+0.3 T+0.2' },
  { type: 'mental',       emoji: '🧘', label: '멘탈',    hint: 'M+0.4 S+0.1' },
  { type: 'conditioning', emoji: '💪', label: '컨디션',  hint: 'T+0.3 M+0.2' },
];

// 레벨별 필요 XP (간단히 클라이언트 계산)
function xpForNextLevel(level: number) {
  let xp = 100;
  for (let i = 1; i < level; i++) xp = Math.ceil(xp * 1.15);
  return xp;
}

export default function HomePage() {
  const toast = useToast();
  const [character, setCharacter] = useState<Character | null | undefined>(undefined);
  const [todayTrainings, setTodayTrainings] = useState<Training[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState<string | null>(null);
  const [feedEvents, setFeedEvents] = useState<{ id: number; msg: string }[]>([]);

  const loadCharacter = useCallback(async () => {
    try {
      const res = await api.get<Character>('/api/characters/me');
      setCharacter(res.data);
    } catch {
      setCharacter(null);
    }
  }, []);

  const loadTrainings = useCallback(async () => {
    try {
      const res = await api.get<Training[]>('/api/trainings/today');
      setTodayTrainings(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadCharacter();
    loadTrainings();
  }, [loadCharacter, loadTrainings]);

  const handleTrain = async (type: string) => {
    if (todayTrainings.length >= 3) { toast('오늘 훈련을 모두 완료했습니다!', 'info'); return; }
    setTrainingLoading(type);
    try {
      const res = await api.post<{
        character: Character;
        training: { bonusApplied: boolean; xpGained: number };
      }>('/api/trainings', { type });
      setCharacter(res.data.character);
      await loadTrainings();
      const bonus = res.data.training.bonusApplied ? ' 🎉 보너스!' : '';
      toast(`훈련 완료! XP +${res.data.training.xpGained}${bonus}`, 'success');
      const id = Date.now();
      setFeedEvents((prev) => [{ id, msg: `${type} 훈련 완료 +${res.data.training.xpGained}XP${bonus}` }, ...prev.slice(0, 4)]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '훈련 실패';
      toast(msg, 'error');
    } finally {
      setTrainingLoading(null);
    }
  };

  if (character === undefined) {
    return <div className="flex items-center justify-center h-screen"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-5">

      {/* 캐릭터 카드 */}
      {character ? (
        <div className="bg-surfaceLight rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-5xl">{ANIMAL_EMOJI[character.animalType] ?? '🐾'}</span>
            <div className="flex-1">
              <p className="font-bold text-textPrimary">{character.name}</p>
              <p className="text-textSecondary text-xs">Lv.{character.level}</p>
            </div>
          </div>
          <ProgressBar
            value={(character.xp / xpForNextLevel(character.level)) * 100}
            label={`${character.xp} / ${xpForNextLevel(character.level)} XP`}
          />
          <div className="flex gap-3 mt-3 text-xs text-textSecondary">
            {(['power','agility','skill','stamina','mind'] as const).map((k) => (
              <span key={k}><span className="font-bold text-textPrimary">{k[0].toUpperCase()}</span>:{character.stats[k]}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-surfaceLight rounded-2xl p-4 border border-white/10 text-center">
          <p className="text-textSecondary mb-3">아직 캐릭터가 없어요</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2 bg-primary rounded-xl text-sm font-semibold text-white"
          >
            캐릭터 만들기
          </button>
        </div>
      )}

      {/* 오늘 배치 상태 */}
      <div className="bg-surfaceLight rounded-2xl p-4 border border-white/10">
        <h3 className="font-semibold text-sm text-textSecondary mb-2">⚾ 오늘의 배치</h3>
        <EmptyState emoji="⚾" title="아직 배치하지 않았어요" description="오늘 경기에 팀을 배치해 캐릭터를 성장시키세요!" />
      </div>

      {/* 오늘의 훈련 */}
      <div className="bg-surfaceLight rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-textSecondary">💪 오늘의 훈련</h3>
          <span className="text-xs text-textSecondary">{todayTrainings.length}/3</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {TRAINING_TYPES.map((t) => {
            const done = todayTrainings.some((tr) => (tr as unknown as { type: string }).type === t.type);
            const loading = trainingLoading === t.type;
            return (
              <button
                key={t.type}
                onClick={() => handleTrain(t.type)}
                disabled={done || loading || todayTrainings.length >= 3}
                className={`flex flex-col items-center p-2 rounded-xl border transition-all
                  ${done ? 'border-green-500/30 bg-green-500/10 opacity-50' :
                    'border-white/10 hover:border-primary active:scale-95'}`}
              >
                <span className="text-2xl">{loading ? '⏳' : t.emoji}</span>
                <span className="text-[10px] font-semibold mt-1 text-textPrimary">{t.label}</span>
                <span className="text-[9px] text-textSecondary">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 실시간 피드 */}
      {feedEvents.length > 0 && (
        <div className="bg-surfaceLight rounded-2xl p-4 border border-white/10">
          <h3 className="font-semibold text-sm text-textSecondary mb-2">📡 활동 피드</h3>
          <AnimatePresence>
            {feedEvents.map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-textPrimary py-1 border-b border-white/5 last:border-0"
              >
                {e.msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateCharacterModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadCharacter}
      />
    </div>
  );
}
