

mkdir -p "client/src/app/(main)"

cat > "client/src/app/(main)/page.tsx" << 'HOMEEOF'
'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [character, setCharacter] = useState<any>(null);
  const [placement, setPlacement] = useState<any>(null);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [battle, setBattle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:string}|null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchAll();
  }, [token, status]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [charRes, placeRes, battleRes] = await Promise.all([
        fetch(`${apiUrl}/api/characters/me`, { headers }),
        fetch(`${apiUrl}/api/placements/today`, { headers }),
        fetch(`${apiUrl}/api/battles/today`, { headers }),
      ]);
      if (charRes.ok) setCharacter(await charRes.json());
      if (placeRes.ok) setPlacement(await placeRes.json());
      if (battleRes.ok) setBattle(await battleRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function doTraining(type: string) {
    setTrainingLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/trainings`, {
        method: 'POST', headers, body: JSON.stringify({ trainingType: type }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ msg: `${type} 훈련 완료! XP +${data.xpGained}`, type: 'success' });
        setTrainings([...trainings, data]);
        fetchAll();
      } else {
        setToast({ msg: data.error || '훈련 실패', type: 'error' });
      }
    } catch (e) { setToast({ msg: '서버 오류', type: 'error' }); }
    setTrainingLoading(false);
    setTimeout(() => setToast(null), 3000);
  }

  if (status === 'loading' || loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><p className="text-textSecondary">로딩 중...</p></div>;

  const animals: Record<string,string> = { bear:'🐻', tiger:'🐯', eagle:'🦅', wolf:'🐺', dragon:'🐲' };
  const trainingTypes = [
    { type:'batting', label:'타격', icon:'⚾' },
    { type:'running', label:'주루', icon:'🏃' },
    { type:'mental', label:'멘탈', icon:'🧠' },
  ];

  return (
    <div className="min-h-screen bg-surface p-4 pb-24 space-y-4">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium ${toast.type==='success'?'bg-green-600':'bg-red-600'} text-white`}>{toast.msg}</div>}
      {character ? (
        <div className="bg-surfaceLight rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{animals[character.animalType]||'🐾'}</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-textPrimary">{character.name}</h2>
              <p className="text-sm text-textSecondary">Lv.{character.level}</p>
              <div className="w-full bg-surface rounded-full h-2 mt-1">
                <div className="bg-primary h-2 rounded-full" style={{width:`${Math.min((character.xp/((character.level||1)*115))*100,100)}%`}}/>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surfaceLight rounded-xl p-6 text-center">
          <p className="text-textSecondary mb-3">캐릭터를 만들어주세요!</p>
          <button onClick={()=>router.push('/character')} className="bg-primary text-white px-4 py-2 rounded-lg text-sm">캐릭터 만들기</button>
        </div>
      )}
      <div className="bg-surfaceLight rounded-xl p-4">
        <h3 className="text-sm font-bold text-textPrimary mb-2">⚾ 오늘의 배치</h3>
        {placement ? (
          <p className="text-sm text-textSecondary">{placement.team} | 상태: {placement.status}</p>
        ) : (
          <button onClick={()=>router.push('/placement')} className="bg-accent text-black px-4 py-2 rounded-lg text-sm font-medium">배치하러 가기</button>
        )}
      </div>
      <div className="bg-surfaceLight rounded-xl p-4">
        <h3 className="text-sm font-bold text-textPrimary mb-2">🏋️ 훈련 ({trainings.length}/3)</h3>
        <div className="flex gap-2">
          {trainingTypes.map(t=>(
            <button key={t.type} onClick={()=>doTraining(t.type)} disabled={trainingLoading||trainings.length>=3}
              className="flex-1 flex flex-col items-center p-3 rounded-lg bg-surface hover:bg-primary/20 transition disabled:opacity-40">
              <span className="text-xl">{t.icon}</span>
              <span className="text-xs text-textSecondary mt-1">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-surfaceLight rounded-xl p-4">
        <h3 className="text-sm font-bold text-textPrimary mb-2">⚔️ 오늘의 대결</h3>
        {battle ? (
          <div className="text-center">
            <p className={`text-2xl font-bold ${battle.result==='win'?'text-green-400':battle.result==='lose'?'text-red-400':'text-yellow-400'}`}>
              {battle.result==='win'?'승리!':battle.result==='lose'?'패배':'무승부'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-textSecondary">경기 정산 후 자동 생성됩니다</p>
        )}
      </div>
    </div>
  );
}
