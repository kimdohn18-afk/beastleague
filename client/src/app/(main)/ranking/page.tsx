'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ANIMAL_EMOJI, getTraitDisplay } from '@/lib/constants';

type Tab = 'league' | 'versus' | 'all';

interface League { _id: string; name: string; code: string; members: string[]; ownerId: string; }
interface RankItem { rank: number; characterId?: string; name: string; animalType: string; xp: number; activeTrait?: string; placedToday: boolean; isMe: boolean; }
interface LeagueRankItem { rank: number; name: string; code: string; memberCount: number; totalXp: number; avgXp: number; isMine: boolean; }
interface AllRankItem { _id?: string; name: string; animalType: string; xp: number; activeTrait?: string; placedToday: boolean; }

export default function RankingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<{ name: string; code: string; memberCount: number } | null>(null);

  const [versusRanking, setVersusRanking] = useState<LeagueRankItem[]>([]);

  const [allRanking, setAllRanking] = useState<AllRankItem[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

 useEffect(() => {
  if (status === 'unauthenticated') router.push('/login');
  if (token) {
    fetchLeagues();
    loadAllRanking();
  }
}, [token, status]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function fetchLeagues() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/leagues`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLeagues(data);
        if (data.length > 0 && !selectedCode) {
          loadLeagueRanking(data[0].code);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadLeagueRanking(code: string) {
    setSelectedCode(code);
    try {
      const res = await fetch(`${apiUrl}/api/leagues/${code}/ranking`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRanking(data.ranking);
        setLeagueInfo(data.league);
      }
    } catch (e) { console.error(e); }
  }

  async function loadVersusRanking() {
    try {
      const res = await fetch(`${apiUrl}/api/leagues/global/ranking`, { headers });
      if (res.ok) setVersusRanking(await res.json());
    } catch (e) { console.error(e); }
  }

  async function loadAllRanking() {
    try {
      const [listRes, meRes] = await Promise.all([
        fetch(`${apiUrl}/api/rankings?type=level&limit=100`, { headers }),
        fetch(`${apiUrl}/api/rankings/me?type=level`, { headers }),
      ]);
      if (listRes.ok) setAllRanking(await listRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        setMyRank(me?.rank ?? null);
      }
    } catch (e) { console.error(e); }
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'versus' && versusRanking.length === 0) loadVersusRanking();
    if (t === 'all' && allRanking.length === 0) loadAllRanking();
  }

  async function handleCreate() {
    if (!newName.trim()) { showToast('리그 이름을 입력해주세요'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/leagues`, { method: 'POST', headers, body: JSON.stringify({ name: newName.trim() }) });
      const data = await res.json();
      if (res.ok) {
        setShowCreate(false); setNewName('');
        await fetchLeagues(); loadLeagueRanking(data.code);
        showToast('리그가 생성되었습니다!');
      } else { showToast(data.error || '생성 실패'); }
    } catch { showToast('서버 오류'); }
    setSubmitting(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) { showToast('초대 코드를 입력해주세요'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/leagues/join`, { method: 'POST', headers, body: JSON.stringify({ code: joinCode.trim().toUpperCase() }) });
      const data = await res.json();
      if (res.ok) {
        setShowJoin(false); setJoinCode('');
        await fetchLeagues(); loadLeagueRanking(data.code);
        showToast('리그에 참가했습니다!');
      } else { showToast(data.error || '참가 실패'); }
    } catch { showToast('서버 오류'); }
    setSubmitting(false);
  }

  async function handleLeave(code: string) {
    if (!confirm('정말 이 리그에서 나가시겠습니까?')) return;
    try {
      const res = await fetch(`${apiUrl}/api/leagues/${code}`, { method: 'DELETE', headers });
      if (res.ok) {
        setSelectedCode(null); setRanking([]); setLeagueInfo(null);
        await fetchLeagues(); showToast('리그에서 나왔습니다');
      }
    } catch { showToast('서버 오류'); }
  }

  function handleShareCode(code: string, name: string) {
    if (typeof window !== 'undefined' && window.Kakao?.Share) {
      if (!window.Kakao.isInitialized()) {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (key) window.Kakao.init(key);
      }
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `⚾ ${name} 리그에 초대합니다!`,
          description: `초대 코드: ${code}\n비스트리그에서 함께 경쟁해요!`,
          imageUrl: 'https://beastleague-client.vercel.app/icon-512.png',
          link: { mobileWebUrl: 'https://beastleague-client.vercel.app', webUrl: 'https://beastleague-client.vercel.app' },
        },
        buttons: [{ title: '참가하기', link: { mobileWebUrl: 'https://beastleague-client.vercel.app', webUrl: 'https://beastleague-client.vercel.app' } }],
      });
    } else {
      navigator.clipboard?.writeText(code);
      showToast(`초대 코드 ${code} 복사됨!`);
    }
  }

  function goToProfile(characterId: string | undefined, isMe?: boolean) {
    if (isMe || !characterId) return;
    router.push(`/profile/${characterId}`);
  }

  const medals = ['🥇', '🥈', '🥉'];

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* 헤더 + 탭 */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-gray-900 text-lg font-bold">랭킹</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowJoin(true)} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full font-medium">참가</button>
            <button onClick={() => setShowCreate(true)} className="text-xs bg-orange-400 text-white px-3 py-1.5 rounded-full font-medium">만들기</button>
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['league', '내 리그'], ['versus', '대항전'], ['all', '전체']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 내 리그 탭 ── */}
      {tab === 'league' && (
        <>
          {leagues.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="text-5xl mb-4">🏟️</div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">아직 참가한 리그가 없어요</h2>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                리그를 만들고 친구를 초대하거나<br />초대 코드를 입력해서 참가해보세요!
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setShowJoin(true)} className="bg-gray-100 text-gray-600 px-5 py-2.5 rounded-2xl text-sm font-medium">코드로 참가</button>
                <button onClick={() => setShowCreate(true)} className="bg-orange-400 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md">리그 만들기</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto">
                {leagues.map((l) => (
                  <button key={l.code} onClick={() => loadLeagueRanking(l.code)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                      selectedCode === l.code ? 'bg-orange-400 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                  >{l.name}</button>
                ))}
              </div>

              {leagueInfo && (
                <div className="mx-4 mt-2 mb-3 bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-gray-800">{leagueInfo.name}</h2>
                    <span className="text-xs text-gray-400">{leagueInfo.memberCount}명</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleShareCode(leagueInfo.code, leagueInfo.name)} className="flex-1 text-xs bg-orange-50 text-orange-500 py-2 rounded-xl font-medium">📢 초대하기</button>
                    <button onClick={() => { navigator.clipboard?.writeText(leagueInfo.code); showToast(`코드 ${leagueInfo.code} 복사됨`); }} className="text-xs bg-gray-50 text-gray-500 px-3 py-2 rounded-xl font-medium">코드 복사</button>
                    <button onClick={() => handleLeave(leagueInfo.code)} className="text-xs bg-red-50 text-red-400 px-3 py-2 rounded-xl font-medium">나가기</button>
                  </div>
                </div>
              )}

              <div className="px-4 space-y-2">
                {ranking.map((r) => {
                  const emoji = ANIMAL_EMOJI[r.animalType] || '🐾';
                  const traitStr = r.activeTrait ? getTraitDisplay(r.activeTrait) : null;
                  return (
                    <div
                      key={r.rank}
                      onClick={() => goToProfile(r.characterId, r.isMe)}
                      className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                        !r.isMe && r.characterId ? 'cursor-pointer active:scale-[0.98]' : ''
                      } ${
                        r.isMe ? 'bg-orange-50 border-2 border-orange-300' : r.rank <= 3 ? 'bg-orange-50 border border-orange-100' : 'bg-white border border-gray-100'
                      }`}
                    >
                      <span className="w-8 text-center text-lg">{r.rank <= 3 ? medals[r.rank - 1] : <span className="text-gray-400 text-xs font-bold">{r.rank}</span>}</span>
                      <span className="text-2xl">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-bold truncate ${r.isMe ? 'text-orange-600' : 'text-gray-900'}`}>{r.name}{r.isMe ? ' (나)' : ''}</p>
                          {r.placedToday ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">배치완료</span>
                          ) : (
                            <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full shrink-0">미배치</span>
                          )}
                        </div>
                        {traitStr && <p className="text-[11px] text-gray-400 mt-0.5">{traitStr}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p className="text-orange-500 text-sm font-bold">{r.xp.toLocaleString()} XP</p>
                        {!r.isMe && r.characterId && <span className="text-gray-300 text-xs">›</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── 대항전 탭 ── */}
      {tab === 'versus' && (
        <div className="px-4 pt-4">
          {versusRanking.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">⚔️</div>
              <p className="text-gray-400">아직 리그가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versusRanking.map((l) => (
                <div key={l.code} className={`p-4 rounded-2xl ${
                  l.isMine ? 'bg-orange-50 border-2 border-orange-300' : l.rank <= 3 ? 'bg-orange-50 border border-orange-100' : 'bg-white border border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{l.rank <= 3 ? medals[l.rank - 1] : <span className="text-gray-400 text-xs font-bold">{l.rank}</span>}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-bold truncate ${l.isMine ? 'text-orange-600' : 'text-gray-900'}`}>{l.name}{l.isMine ? ' ⭐' : ''}</p>
                        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full shrink-0">{l.memberCount}명</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">평균 {l.avgXp.toLocaleString()} XP</p>
                    </div>
                    <p className="text-orange-500 text-sm font-bold shrink-0">{l.totalXp.toLocaleString()} XP</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 전체 랭킹 탭 ── */}
      {tab === 'all' && (
        <div className="px-4 pt-4">
          {allRanking.length === 0 ? (
            <div className="text-center py-20"><p className="text-gray-400">랭킹 데이터가 없습니다</p></div>
          ) : (
            <div className="space-y-2">
              {allRanking.map((r: any, i: number) => {
                const emoji = ANIMAL_EMOJI[r.animalType] || '🐾';
                const traitStr = r.activeTrait ? getTraitDisplay(r.activeTrait) : null;
                return (
                  <div
                    key={i}
                    onClick={() => goToProfile(r._id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      r._id ? 'cursor-pointer active:scale-[0.98]' : ''
                    } ${
                      i < 3 ? 'bg-orange-50 border border-orange-100' : 'bg-white border border-gray-100'
                    }`}
                  >
                    <span className="w-8 text-center text-lg">{i < 3 ? medals[i] : <span className="text-gray-400 text-xs font-bold">{i + 1}</span>}</span>
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-gray-900 truncate">{r.name || '???'}</p>
                        {r.placedToday ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">배치완료</span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full shrink-0">미배치</span>
                        )}
                      </div>
                      {traitStr && <p className="text-[11px] text-gray-400 mt-0.5">{traitStr}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className="text-orange-500 text-sm font-bold">{(r.xp ?? 0).toLocaleString()} XP</p>
                      {r._id && <span className="text-gray-300 text-xs">›</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {myRank && (
            <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
              <div className="bg-orange-400 rounded-2xl p-3 flex items-center justify-between shadow-lg">
                <span className="text-white text-sm font-bold">내 순위</span>
                <span className="text-white text-lg font-bold">{myRank}위</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 리그 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">리그 만들기</h2>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="리그 이름 (예: 우리반 리그)" maxLength={20}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">취소</button>
              <button onClick={handleCreate} disabled={submitting} className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold disabled:opacity-50">{submitting ? '생성 중...' : '만들기'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 리그 참가 모달 */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowJoin(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">리그 참가</h2>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="초대 코드 6자리" maxLength={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-center tracking-[0.3em] font-bold focus:outline-none focus:border-orange-400 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowJoin(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">취소</button>
              <button onClick={handleJoin} disabled={submitting} className="flex-1 py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold disabled:opacity-50">{submitting ? '참가 중...' : '참가하기'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
