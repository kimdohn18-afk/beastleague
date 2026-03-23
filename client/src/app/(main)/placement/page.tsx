'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlacementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [games, setGames] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetch(`${apiUrl}/api/games?date=today`, { headers })
      .then(r => r.json()).then(setGames).catch(console.error).finally(() => setLoading(false));
  }, [token, status]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/placements`, {
        method: 'POST', headers,
        body: JSON.stringify({ gameId: selectedGame._id, team: selectedTeam, groupType: selectedGroup }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ msg: '배치 완료!', type: 'success' });
        setTimeout(() => router.push('/'), 1500);
      } else {
        setToast({ msg: data.error || '배치 실패', type: 'error' });
      }
    } catch (e) { setToast({ msg: '서버 오류', type: 'error' }); }
    setSubmitting(false);
    setTimeout(() => setToast(null), 3000);
  }

  if (status === 'loading' || loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-textSecondary">로딩 중...</p></div>;

  const groups = [
    { key: 'top', label: '상위타선 (1-3번)', desc: '타격 스탯 보너스', icon: '🔥' },
    { key: 'cleanup', label: '클린업 (4-6번)', desc: '파워 스탯 보너스', icon: '💪' },
    { key: 'lower', label: '하위타선 (7-9번)', desc: '민첩 스탯 보너스', icon: '🏃' },
    { key: 'pitcher', label: '투수', desc: '멘탈+체력 보너스', icon: '⚾' },
  ];

  return (
    <div className="min-h-screen bg-surface p-4 pb-24">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium ${toast.type==='success'?'bg-green-600':'bg-red-600'} text-white`}>{toast.msg}</div>}

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => step > 1 ? setStep(step-1) : router.push('/')} className="text-textSecondary text-xl">←</button>
        <h1 className="text-lg font-bold text-textPrimary">배치하기 ({step}/4)</h1>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-textSecondary mb-2">오늘의 경기를 선택하세요</p>
          {games.length === 0 ? (
            <p className="text-textSecondary text-center py-8">오늘 예정된 경기가 없습니다</p>
          ) : games.map(g => (
            <button key={g._id} onClick={() => { setSelectedGame(g); setStep(2); }}
              className="w-full bg-surfaceLight rounded-xl p-4 text-left hover:ring-2 ring-primary transition">
              <p className="text-textPrimary font-bold">{g.homeTeam} vs {g.awayTeam}</p>
              <p className="text-xs text-textSecondary mt-1">{g.stadium} · {g.time || '18:30'}</p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && selectedGame && (
        <div className="space-y-3">
          <p className="text-sm text-textSecondary mb-2">응원할 팀을 선택하세요</p>
          {[selectedGame.homeTeam, selectedGame.awayTeam].map(team => (
            <button key={team} onClick={() => { setSelectedTeam(team); setStep(3); }}
              className="w-full bg-surfaceLight rounded-xl p-4 text-center hover:ring-2 ring-primary transition">
              <p className="text-textPrimary font-bold text-lg">{team}</p>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-textSecondary mb-2">라인업 그룹을 선택하세요</p>
          {groups.map(g => (
            <button key={g.key} onClick={() => { setSelectedGroup(g.key); setStep(4); }}
              className="w-full bg-surfaceLight rounded-xl p-4 text-left hover:ring-2 ring-primary transition">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{g.icon}</span>
                <div>
                  <p className="text-textPrimary font-bold">{g.label}</p>
                  <p className="text-xs text-textSecondary">{g.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="bg-surfaceLight rounded-xl p-6 text-center space-y-4">
          <p className="text-sm text-textSecondary">배치 확인</p>
          <p className="text-textPrimary font-bold text-lg">{selectedGame.homeTeam} vs {selectedGame.awayTeam}</p>
          <p className="text-primary font-bold">{selectedTeam} · {groups.find(g=>g.key===selectedGroup)?.label}</p>
          <button onClick={submit} disabled={submitting}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold text-lg disabled:opacity-50">
            {submitting ? '배치 중...' : '배치 확정!'}
          </button>
        </div>
      )}
    </div>
  );
}
