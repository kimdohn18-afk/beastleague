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

interface PredictionItem {
  gameId: string;
  predictedWinner: string;
  scoreDiffRange: string | null;
  totalRunsRange: string | null;
  xpBetOnDiff: number;
  xpBetOnTotal: number;
  totalBet: number;
  status: string;
  result: {
    winCorrect: boolean;
    diffCorrect?: boolean;
    totalCorrect?: boolean;
    netXp: number;
    xpFromWin: number;
    xpFromDiff: number;
    xpFromTotal: number;
    xpLostDiff: number;
    xpLostTotal: number;
  } | null;
  game: {
    gameId: string;
    homeTeam: string;
    awayTeam: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
    startTime: string;
  } | null;
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
  todayPredictions: PredictionItem[] | null;
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

  const [showPredictions, setShowPredictions] = useState(false);
  const [toast, setToast] = useState('');

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
      } catch (e) {
        console.error('Profile fetch error:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [characterId]);

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

  const { character, todayPredictions } = profile;
  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const size = getCharacterSize(character.xp);

  const totalBetXp = todayPredictions?.reduce((sum, p) => sum + (p.totalBet || 0), 0) || 0;
  const settledPredictions = todayPredictions?.filter(p => p.status === 'settled') || [];
  const totalNetXp = settledPredictions.reduce((sum, p) => sum + (p.result?.netXp || 0), 0);

  const diffRangeLabel = (r: string) => {
    if (r === '1-2') return '1~2점차';
    if (r === '3-4') return '3~4점차';
    if (r === '5+') return '5점차 이상';
    return r;
  };

  const totalRangeLabel = (r: string) => {
    if (r === 'low') return '로스코어 (0~5)';
    if (r === 'normal') return '보통 (6~10)';
    if (r === 'high') return '하이스코어 (11+)';
    return r;
  };

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

      {/* 오늘의 예측 */}
      <div className="px-6">
        <button onClick={() => setShowPredictions(!showPredictions)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-orange-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">⚾ 오늘의 예측</span>
            {todayPredictions && todayPredictions.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-500 px-2 py-0.5 rounded-full font-medium">
                {todayPredictions.length}경기
              </span>
            )}
          </div>
          <span className="text-gray-400 text-lg">{showPredictions ? '▲' : '▼'}</span>
        </button>

        {showPredictions && (
          <div className="mt-2 space-y-2">
            {todayPredictions && todayPredictions.length > 0 ? (
              <>
                {todayPredictions.map((p, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                    {p.game && (
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-bold">
                          <span>{teamLabel(p.game.homeTeam)}</span>
                          <span className="text-gray-300">vs</span>
                          <span>{teamLabel(p.game.awayTeam)}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === 'settled'
                            ? (p.result && p.result.netXp >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {p.status === 'settled' ? (p.result && p.result.netXp >= 0 ? '✅ 수익' : '❌ 손실') : '⏳ 대기'}
                        </span>
                      </div>
                    )}

                    {/* 스코어: 경기 끝난 경우만 표시 */}
                    {p.game && p.game.status === 'finished' && p.game.homeScore != null && p.game.awayScore != null && (
                      <div className="text-center mb-2">
                        <span className="text-lg font-bold text-gray-700">
                          {p.game.homeScore} : {p.game.awayScore}
                        </span>
                      </div>
                    )}

                    {/* 예측 내용 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-400">승리 예측</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold">{teamLabel(p.predictedWinner)}</span>
                          {p.status === 'settled' && p.result && (
                            <span className="text-xs">{p.result.winCorrect ? '✅' : '❌'}</span>
                          )}
                        </div>
                      </div>

                      {p.scoreDiffRange && (
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400">점수차 ({p.xpBetOnDiff} XP)</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold">{diffRangeLabel(p.scoreDiffRange)}</span>
                            {p.status === 'settled' && p.result && p.result.diffCorrect !== undefined && (
                              <span className="text-xs">{p.result.diffCorrect ? '✅' : '❌'}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {p.totalRunsRange && (
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400">총득점 ({p.xpBetOnTotal} XP)</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold">{totalRangeLabel(p.totalRunsRange)}</span>
                            {p.status === 'settled' && p.result && p.result.totalCorrect !== undefined && (
                              <span className="text-xs">{p.result.totalCorrect ? '✅' : '❌'}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 결과 XP */}
                    {p.status === 'settled' && p.result && (
                      <div className={`mt-2 rounded-lg px-3 py-2 text-center ${
                        p.result.netXp >= 0 ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <span className={`text-sm font-bold ${
                          p.result.netXp >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {p.result.netXp >= 0 ? '+' : ''}{p.result.netXp} XP
                        </span>
                      </div>
                    )}

                    {p.status === 'active' && p.totalBet > 0 && (
                      <div className="mt-2 text-center">
                        <span className="text-xs text-gray-400">총 베팅: {p.totalBet} XP</span>
                      </div>
                    )}
                  </div>
                ))}

                <div className="bg-orange-50 rounded-2xl p-3 text-center border border-orange-200">
                  {settledPredictions.length > 0 ? (
                    <p className="text-sm font-bold">
                      오늘 수익: <span className={totalNetXp >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {totalNetXp >= 0 ? '+' : ''}{totalNetXp} XP
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">총 베팅: {totalBetXp} XP · 결과 대기중</p>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100 text-center">
                <p className="text-gray-400 text-sm">오늘 아직 예측하지 않았어요</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 mt-4 space-y-3">
        <div className="bg-white/50 rounded-2xl p-4 border border-dashed border-orange-200 text-center">
          <p className="text-sm text-gray-400">📝 방명록 (곧 추가 예정)</p>
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
