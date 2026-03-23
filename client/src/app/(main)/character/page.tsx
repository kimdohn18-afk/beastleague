'use client';
import { useEffect, useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import ProgressBar from '@/components/ProgressBar';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import StatBadge from '@/components/StatBadge';
import type { Character } from '@beastleague/shared';

const ANIMAL_EMOJI: Record<string, string> = {
  bear: '🐻', tiger: '🐯', eagle: '🦅', wolf: '🐺', dragon: '🐲',
};

function xpForNextLevel(level: number) {
  let xp = 100;
  for (let i = 1; i < level; i++) xp = Math.ceil(xp * 1.15);
  return xp;
}

type Tab = 'stats' | 'placements' | 'battles';

export default function CharacterPage() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('stats');
  const [history, setHistory] = useState<unknown[]>([]);
  const [placements, setPlacements] = useState<unknown[]>([]);
  const [battles, setBattles] = useState<unknown[]>([]);

  useEffect(() => {
    api.get<Character>('/api/characters/me')
      .then((r) => setCharacter(r.data))
      .catch(() => setCharacter(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'stats') api.get<unknown[]>('/api/characters/me/history').then((r) => setHistory(r.data)).catch(() => {});
    if (tab === 'placements') api.get<unknown[]>('/api/placements/history').then((r) => setPlacements(r.data)).catch(() => {});
    if (tab === 'battles') api.get<unknown[]>('/api/battles/history').then((r) => setBattles(r.data)).catch(() => {});
  }, [tab]);

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner /></div>;
  if (!character) return (
    <div className="flex justify-center pt-20">
      <EmptyState emoji="🐾" title="캐릭터가 없습니다" description="홈 화면에서 캐릭터를 먼저 만들어주세요" />
    </div>
  );

  const radarData = [
    { stat: 'Power',   value: character.stats.power },
    { stat: 'Agility', value: character.stats.agility },
    { stat: 'Skill',   value: character.stats.skill },
    { stat: 'Stamina', value: character.stats.stamina },
    { stat: 'Mind',    value: character.stats.mind },
  ];

  const nextXp = xpForNextLevel(character.level);

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto space-y-5">
      {/* 프로필 */}
      <div className="bg-surfaceLight rounded-2xl p-5 border border-white/10 text-center">
        <span className="text-7xl">{ANIMAL_EMOJI[character.animalType] ?? '🐾'}</span>
        <h2 className="font-black text-xl mt-2">{character.name}</h2>
        <p className="text-textSecondary text-sm">Lv.{character.level}</p>
        <div className="mt-4">
          <ProgressBar value={(character.xp / nextXp) * 100} label={`${character.xp} / ${nextXp} XP`} />
        </div>
      </div>

      {/* 레이더 차트 */}
      <div className="bg-surfaceLight rounded-2xl p-4 border border-white/10">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#2a2a3e" />
            <PolarAngleAxis dataKey="stat" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-white/10">
        {([['stats','성장 기록'],['placements','배치 이력'],['battles','대결 기록']] as [Tab,string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-textSecondary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {tab === 'stats' && (
        <div className="space-y-2 pb-4">
          {history.length === 0
            ? <EmptyState emoji="📊" title="아직 기록이 없습니다" />
            : (history as Array<{ _id: string; source: string; createdAt: string; after: Record<string, number>; before: Record<string, number> }>).map((log) => (
                <div key={log._id} className="bg-surfaceLight rounded-xl p-3 border border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-textSecondary">{log.source}</span>
                    <span className="text-xs text-textSecondary">{new Date(log.createdAt).toLocaleDateString('ko')}</span>
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {(['power','agility','skill','stamina','mind'] as const).map((k) => {
                      const diff = (log.after?.[k] ?? 0) - (log.before?.[k] ?? 0);
                      return diff !== 0 ? <StatBadge key={k} value={diff} /> : null;
                    })}
                  </div>
                </div>
              ))}
        </div>
      )}

      {tab === 'placements' && (
        <div className="space-y-2 pb-4">
          {placements.length === 0
            ? <EmptyState emoji="⚾" title="배치 이력이 없습니다" />
            : (placements as Array<{ _id: string; team: string; groupType: string; date: string; status: string }>).map((p) => (
                <div key={p._id} className="bg-surfaceLight rounded-xl p-3 border border-white/10 flex justify-between">
                  <span className="text-sm font-medium">{p.team} {p.groupType}</span>
                  <span className="text-xs text-textSecondary">{p.date}</span>
                </div>
              ))}
        </div>
      )}

      {tab === 'battles' && (
        <div className="space-y-2 pb-4">
          {battles.length === 0
            ? <EmptyState emoji="⚔️" title="대결 기록이 없습니다" />
            : <EmptyState emoji="⚔️" title="대결 기록" description="경기 종료 후 자동 매칭됩니다" />}
        </div>
      )}
    </div>
  );
}
