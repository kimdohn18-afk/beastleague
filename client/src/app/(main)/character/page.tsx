'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CharacterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<any>(null);
  const [tab, setTab] = useState<'stats'|'placements'|'battles'>('stats');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetch(`${apiUrl}/api/characters/me`, { headers })
      .then(r => r.json()).then(setCharacter).catch(console.error).finally(() => setLoading(false));
  }, [token, status]);

  useEffect(() => {
    if (!token) return;
    const endpoints: Record<string,string> = {
      stats: '/api/characters/me/history?limit=20',
      placements: '/api/placements/history?limit=20',
      battles: '/api/battles/history?limit=20',
    };
    fetch(`${apiUrl}${endpoints[tab]}`, { headers })
      .then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => setHistory([]));
  }, [tab, token]);

  if (status === 'loading' || loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-textSecondary">로딩 중...</p></div>;
  if (!character) return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-textSecondary">캐릭터가 없습니다</p></div>;

  const animals: Record<string,string> = { bear:'🐻', tiger:'🐯', eagle:'🦅', wolf:'🐺', dragon:'🐲' };
  const stats = character.stats || {};
  const statList = [
    { key:'power', label:'파워', icon:'💪', val: stats.power||0 },
    { key:'agility', label:'민첩', icon:'🏃', val: stats.agility||0 },
    { key:'skill', label:'기술', icon:'🎯', val: stats.skill||0 },
    { key:'stamina', label:'체력', icon:'❤️', val: stats.stamina||0 },
    { key:'mind', label:'멘탈', icon:'🧠', val: stats.mind||0 },
  ];
  const maxStat = Math.max(...statList.map(s => s.val), 1);

  return (
    <div className="min-h-screen bg-surface p-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.push('/')} className="text-textSecondary text-xl">←</button>
        <h1 className="text-lg font-bold text-textPrimary">내 캐릭터</h1>
      </div>

      <div className="bg-surfaceLight rounded-xl p-6 text-center mb-4">
        <span className="text-6xl">{animals[character.animalType]||'🐾'}</span>
        <h2 className="text-xl font-bold text-textPrimary mt-2">{character.name}</h2>
        <p className="text-sm text-textSecondary">Lv.{character.level} · XP {character.xp}/{(character.level||1)*115}</p>
        <div className="w-full bg-surface rounded-full h-3 mt-2">
          <div className="bg-primary h-3 rounded-full transition-all" style={{width:`${Math.min((character.xp/((character.level||1)*115))*100,100)}%`}}/>
        </div>
      </div>

      <div className="bg-surfaceLight rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold text-textPrimary mb-3">스탯</h3>
        {statList.map(s => (
          <div key={s.key} className="flex items-center gap-2 mb-2">
            <span className="w-6 text-center">{s.icon}</span>
            <span className="w-10 text-xs text-textSecondary">{s.label}</span>
            <div className="flex-1 bg-surface rounded-full h-4">
              <div className="bg-primary h-4 rounded-full transition-all" style={{width:`${(s.val/maxStat)*100}%`}}/>
            </div>
            <span className="w-12 text-right text-xs text-textPrimary font-mono">{s.val.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-3">
        {(['stats','placements','battles'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg ${tab===t?'bg-primary text-white':'bg-surfaceLight text-textSecondary'}`}>
            {t==='stats'?'성장기록':t==='placements'?'배치기록':'대결기록'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {history.length === 0 ? (
          <p className="text-center text-textSecondary text-sm py-4">기록이 없습니다</p>
        ) : history.map((h, i) => (
          <div key={i} className="bg-surfaceLight rounded-lg p-3">
            <p className="text-xs text-textSecondary">{new Date(h.createdAt || h.date).toLocaleDateString('ko-KR')}</p>
            {tab === 'stats' && <p className="text-sm text-textPrimary">파워 {h.changes?.power > 0 ? '+' : ''}{h.changes?.power?.toFixed(1) || 0} | 민첩 {h.changes?.agility > 0 ? '+' : ''}{h.changes?.agility?.toFixed(1) || 0}</p>}
            {tab === 'placements' && <p className="text-sm text-textPrimary">{h.team} · {h.groupType} · {h.status}</p>}
            {tab === 'battles' && <p className="text-sm text-textPrimary">{h.result === 'win' ? '승리' : h.result === 'lose' ? '패배' : '무승부'} · XP +{h.xpGained || 0}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
