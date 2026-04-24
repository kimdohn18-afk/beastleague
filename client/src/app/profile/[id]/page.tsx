'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import WalkingCharacter from '@/components/WalkingCharacter';
import { PIXEL_ART_ANIMALS, getEvolutionStage } from '@/lib/constants';
import { getDisplayName } from '@beastleague/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const ANIMAL_EMOJI: Record<string, string> = {
  bear: '🐻', tiger: '🐯', eagle: '🦅', dragon: '🐉', wolf: '🐺',
  fox: '🦊', lion: '🦁', shark: '🦈', phoenix: '🔥', unicorn: '🦄',
  turtle: '🐢', dinosaur: '🦕', dog: '🐶', penguin: '🐧', seagull: '🕊️',
  cat: '🐱', rabbit: '🐰', gorilla: '🦍', elephant: '🐘',
};

const ANIMAL_NAMES: Record<string, string> = {
  bear: '곰', tiger: '호랑이', eagle: '독수리', dragon: '드래곤', wolf: '늑대',
  fox: '여우', lion: '사자', shark: '상어', phoenix: '불사조', unicorn: '유니콘',
  turtle: '거북이', dinosaur: '공룡', dog: '강아지', penguin: '펭귄', seagull: '갈매기',
  cat: '고양이', rabbit: '토끼', gorilla: '고릴라', elephant: '코끼리',
};

function getCharacterSize(xp: number): number {
  const size = 60 + Math.pow(xp, 0.55) * 7.5;
  return Math.round(Math.min(size, 300));
}

interface PlacementInfo {
  gameId: string;
  team: string;
  battingOrder: number;
  predictedWinner: string;
  playerName: string | null;
  status: string;
  xpFromPlayer: number | null;
  xpFromPrediction: number | null;
  xpBreakdown: Record<string, number> | null;
  game: {
    homeTeam: string;
    awayTeam: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
    startTime: string;
  } | null;
}

interface GuestBookEntry {
  id: string;
  fromCharacterName: string;
  fromAnimalType: string;
  message: string;
  createdAt: string;
}

interface PublicProfile {
  character: {
    id: string;
    name: string;
    animalType: string;
    xp: number;
    activeTrait: string | null;
    totalPlacements: number;
    streak: number;
    totalLikes: number;
    totalFeeds: number;
    createdAt: string;
  };
  todayPlacement: PlacementInfo | null;
  guestBook: GuestBookEntry[];
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const characterId = params.id as string;
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [liked, setLiked] = useState(false);
  const [totalLikes, setTotalLikes] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  const [fed, setFed] = useState(false);
  const [feedAnimation, setFeedAnimation] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [totalFeeds, setTotalFeeds] = useState(0);
  const [remainingFeeds, setRemainingFeeds] = useState(3);

  const [showPlacement, setShowPlacement] = useState(true);
  const [toast, setToast] = useState('');

  // 방명록
  const [guestBookEntries, setGuestBookEntries] = useState<GuestBookEntry[]>([]);
  const [guestBookMsg, setGuestBookMsg] = useState('');
  const [guestBookWritten, setGuestBookWritten] = useState(false);
  const [guestBookLoading, setGuestBookLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [myCharacterId, setMyCharacterId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/api/characters/${characterId}/public`);
        if (!res.ok) { setError(true); return; }
        const data: PublicProfile = await res.json();
        setProfile(data);
        setTotalLikes(data.character.totalLikes);
        setTotalFeeds(data.character.totalFeeds);
        setGuestBookEntries(data.guestBook || []);
      } catch (e) {
        console.error('Profile fetch error:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [characterId]);

  // 내 캐릭터 확인 (프로필 주인 여부 + 방명록 작성 여부)
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/characters/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setMyCharacterId(String(d._id));
        if (String(d._id) === characterId) setIsOwner(true);
      }
    }).catch(() => {});
  }, [token, characterId]);

  useEffect(() => {
    if (!token || !characterId) return;
    fetch(`${API_URL}/api/characters/${characterId}/like-status`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null).then(d => d && setLiked(d.liked)).catch(() => {});
  }, [token, characterId]);

  useEffect(() => {
    if (!token || !characterId) return;
    fetch(`${API_URL}/api/characters/${characterId}/feed-status`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setFed(d.fed); setRemainingFeeds(d.remainingFeeds); }
    }).catch(() => {});
  }, [token, characterId]);

  const handleLike = async () => {
    if (!session || liked || likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/characters/${characterId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) { setLiked(true); setTotalLikes(data.totalLikes); showToast('❤️ 좋아요를 보냈어요!'); }
      else { if (data.code === 'alreadyLiked') setLiked(true); showToast(data.error || '좋아요 실패'); }
    } catch { showToast('네트워크 오류'); }
    finally { setLikeLoading(false); }
  };

  const handleFeed = async () => {
    if (!session || fed || feedLoading) return;
    setFeedLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/characters/${characterId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setFed(true); setTotalFeeds(data.totalFeeds); setRemainingFeeds(data.remainingFeeds ?? remainingFeeds);
        setFeedAnimation(true); setTimeout(() => setFeedAnimation(false), 1800);
        showToast(`🍖 밥을 줬어요! (-${data.cost} XP → +${data.given} XP)`);
      } else {
        if (data.code === 'alreadyFed') setFed(true);
        if (data.code === 'limitReached') setRemainingFeeds(0);
        showToast(data.error || '밥주기 실패');
      }
    } catch { showToast('네트워크 오류'); }
    finally { setFeedLoading(false); }
  };

  const handleGuestBookSubmit = async () => {
    if (!token || !guestBookMsg.trim() || guestBookLoading || guestBookWritten) return;
    setGuestBookLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/characters/${characterId}/guestbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: guestBookMsg.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setGuestBookEntries(prev => [data, ...prev]);
        setGuestBookMsg('');
        setGuestBookWritten(true);
        showToast('📝 방명록을 남겼어요!');
      } else {
        if (data.code === 'alreadyWritten') setGuestBookWritten(true);
        showToast(data.error || '방명록 작성 실패');
      }
    } catch { showToast('네트워크 오류'); }
    finally { setGuestBookLoading(false); }
  };

  const handleGuestBookDelete = async (entryId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/characters/${characterId}/guestbook/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setGuestBookEntries(prev => prev.filter(e => e.id !== entryId));
        showToast('🗑️ 방명록을 삭제했어요');
      } else {
        const data = await res.json();
        showToast(data.error || '삭제 실패');
      }
    } catch { showToast('네트워크 오류'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 p-6">
        <p className="text-gray-500 text-lg mb-4">캐릭터를 찾을 수 없습니다</p>
        <button onClick={() => router.back()} className="px-4 py-2 bg-orange-400 text-white rounded-lg">돌아가기</button>
      </div>
    );
  }

  const { character, todayPlacement } = profile;
  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const size = getCharacterSize(character.xp);

  const placementTotalXp = todayPlacement
    ? (todayPlacement.xpFromPlayer || 0) + (todayPlacement.xpFromPrediction || 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-20">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm z-50 animate-bounce">
          {toast}
        </div>
      )}

      {feedAnimation && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {['🍖', '🥩', '🍗'].map((food, i) => (
            <div key={i} className="absolute text-3xl" style={{ left: `${30 + i * 20}%`, animation: `feedFly${i} 1.5s ease-in forwards` }}>
              {food}
            </div>
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 text-2xl font-bold text-orange-500" style={{ animation: 'nomnom 1.5s ease-out forwards' }}>
            냠냠!
          </div>
        </div>
      )}

      <div className="sticky top-0 bg-white/80 backdrop-blur border-b border-orange-100 px-4 py-3 flex items-center z-40">
        <button onClick={() => router.back()} className="text-gray-500 text-lg mr-3">←</button>
        <h1 className="text-lg font-bold text-gray-800">{character.name}의 프로필</h1>
      </div>

      <WalkingCharacter
        animalType={character.animalType}
        characterSize={size}
        isPixelArt={PIXEL_ART_ANIMALS.includes(character.animalType)}
        emoji={emoji}
      />

      <div className="flex flex-col items-center pt-10 pb-6">
        {(() => {
          const evo = getEvolutionStage(character.xp);
          return (
            <div className="flex items-center gap-2 mb-1 justify-center">
              <span className="text-lg">{evo.badge}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${evo.bgColor} ${evo.color}`}>
                {evo.stage}단계 · {evo.name}
              </span>
            </div>
          );
        })()}
        <h2 className="text-xl font-bold text-gray-800 mt-4">{character.name}</h2>
        <p className="text-sm text-gray-400 mt-1">{animalName} · {character.xp.toLocaleString()} XP</p>
        {character.streak > 0 && <p className="text-xs text-orange-400 mt-1">🔥 {character.streak}일 연속</p>}
        {character.activeTrait && (
          <div className="mt-2 bg-white/80 backdrop-blur rounded-xl px-3 py-1.5 border border-orange-100 shadow-sm">
            <p className="text-sm text-gray-700">{character.activeTrait}</p>
          </div>
        )}
        <div className="flex items-center gap-4 mt-3">
          {totalLikes > 0 && <span className="text-sm text-pink-400">❤️ {totalLikes}</span>}
          {totalFeeds > 0 && <span className="text-sm text-orange-400">🍖 {totalFeeds}</span>}
        </div>
      </div>

      {token && (
        <div className="flex justify-center gap-3 px-6 mb-6">
          <button onClick={handleLike} disabled={liked || likeLoading}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              liked ? 'bg-pink-100 text-pink-400 cursor-not-allowed' : 'bg-white text-pink-500 border-2 border-pink-300 hover:bg-pink-50 active:scale-95 shadow-sm'
            }`}>
            {liked ? '❤️' : '🤍'} {liked ? '좋아요 완료' : '좋아요'}
          </button>
          <button onClick={handleFeed} disabled={fed || feedLoading}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              fed ? 'bg-orange-100 text-orange-400 cursor-not-allowed' : 'bg-orange-400 text-white hover:bg-orange-500 active:scale-95 shadow-md'
            }`}>
            🍖 {fed ? '밥 완료' : '밥주기'}{!fed && <span className="text-xs opacity-70">(-5 XP)</span>}
          </button>
        </div>
      )}

      {/* ── 오늘의 배치 ── */}
      <div className="px-6 mb-3">
        <button onClick={() => setShowPlacement(!showPlacement)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-orange-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">🏟️ 오늘의 배치</span>
            {todayPlacement && (
              <span className="text-xs bg-blue-100 text-blue-500 px-2 py-0.5 rounded-full font-medium">
                {todayPlacement.battingOrder}번 타순
              </span>
            )}
          </div>
          <span className="text-gray-400 text-lg">{showPlacement ? '▲' : '▼'}</span>
        </button>

        {showPlacement && (
          <div className="mt-2">
            {todayPlacement ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                {todayPlacement.game && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span>{getDisplayName(todayPlacement.game.homeTeam as any)}</span>
                      <span className="text-gray-300">vs</span>
                      <span>{getDisplayName(todayPlacement.game.awayTeam as any)}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      todayPlacement.status === 'settled'
                        ? 'bg-green-100 text-green-600'
                        : todayPlacement.game.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}>
                      {todayPlacement.status === 'settled' ? '✅ 정산완료'
                        : todayPlacement.game.status === 'in_progress' ? '🔴 경기중'
                        : '⏳ 대기'}
                    </span>
                  </div>
                )}

                {todayPlacement.game && todayPlacement.game.status === 'finished' &&
                  todayPlacement.game.homeScore != null && todayPlacement.game.awayScore != null && (
                  <div className="text-center mb-3">
                    <span className="text-lg font-bold text-gray-700">
                      {todayPlacement.game.homeScore} : {todayPlacement.game.awayScore}
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400">배치 팀</span>
                    <span className="text-sm font-bold">{getDisplayName(todayPlacement.team as any)}</span>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400">타순</span>
                    <span className="text-sm font-bold">{todayPlacement.battingOrder}번</span>
                  </div>

                  {todayPlacement.playerName && (
                    <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-400">선수</span>
                      <span className="text-sm font-bold text-blue-600">{todayPlacement.playerName}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400">승리 예측</span>
                    <span className="text-sm font-bold">{getDisplayName(todayPlacement.predictedWinner as any)}</span>
                  </div>
                </div>

                {todayPlacement.status === 'settled' && (
                  <div className={`mt-3 rounded-lg px-3 py-2 text-center ${
                    placementTotalXp >= 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <span className={`text-sm font-bold ${
                      placementTotalXp >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {placementTotalXp >= 0 ? '+' : ''}{placementTotalXp} XP
                    </span>
                    {todayPlacement.xpFromPlayer != null && todayPlacement.xpFromPrediction != null && (
                      <p className="text-xs text-gray-400 mt-1">
                        타자 {todayPlacement.xpFromPlayer >= 0 ? '+' : ''}{todayPlacement.xpFromPlayer} · 예측 {todayPlacement.xpFromPrediction >= 0 ? '+' : ''}{todayPlacement.xpFromPrediction}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100 text-center">
                <p className="text-gray-400 text-sm">오늘 아직 배치하지 않았어요</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 방명록 ── */}
      <div className="px-6 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">📝 방명록</h3>

          {/* 작성 폼 */}
          {token && !isOwner && !guestBookWritten && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={guestBookMsg}
                onChange={e => setGuestBookMsg(e.target.value)}
                placeholder="메시지를 남겨보세요 (100자)"
                maxLength={100}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-300"
              />
              <button
                onClick={handleGuestBookSubmit}
                disabled={!guestBookMsg.trim() || guestBookLoading}
                className="px-4 py-2 bg-orange-400 text-white text-sm font-bold rounded-xl hover:bg-orange-500 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
              >
                등록
              </button>
            </div>
          )}

          {token && !isOwner && guestBookWritten && (
            <p className="text-xs text-gray-400 mb-4">✅ 오늘 방명록을 남겼어요</p>
          )}

          {/* 방명록 목록 */}
          {guestBookEntries.length > 0 ? (
            <div className="space-y-2">
              {guestBookEntries.map(entry => (
                <div key={entry.id} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{ANIMAL_EMOJI[entry.fromAnimalType] || '🐾'}</span>
                      <span className="text-xs font-bold text-gray-700">{entry.fromCharacterName}</span>
                      <span className="text-xs text-gray-300">
                        {new Date(entry.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{entry.message}</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleGuestBookDelete(entry.id)}
                      className="text-xs text-red-300 hover:text-red-500 ml-2 mt-1"
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-300 text-sm py-4">아직 방명록이 없어요</p>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes feedFly0 { 0% { top: 80%; opacity: 1; transform: scale(1); } 80% { top: 40%; opacity: 1; transform: scale(1.3); } 100% { top: 35%; opacity: 0; transform: scale(0.5); } }
        @keyframes feedFly1 { 0% { top: 85%; opacity: 1; transform: scale(1); } 80% { top: 42%; opacity: 1; transform: scale(1.2); } 100% { top: 37%; opacity: 0; transform: scale(0.5); } }
        @keyframes feedFly2 { 0% { top: 82%; opacity: 1; transform: scale(1); } 80% { top: 38%; opacity: 1; transform: scale(1.4); } 100% { top: 33%; opacity: 0; transform: scale(0.5); } }
        @keyframes nomnom { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); } 30% { opacity: 1; transform: translate(-50%, -20px) scale(1.2); } 60% { opacity: 1; transform: translate(-50%, -30px) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50px) scale(0.8); } }
      `}</style>
    </div>
  );
}
