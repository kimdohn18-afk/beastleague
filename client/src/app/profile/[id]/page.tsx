'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

/* ───── 상수 ───── */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const ANIMAL_EMOJI: Record<string, string> = {
  bear: '🐻',
  tiger: '🐯',
  eagle: '🦅',
  dragon: '🐉',
  wolf: '🐺',
  fox: '🦊',
  lion: '🦁',
  shark: '🦈',
  phoenix: '🔥',
  unicorn: '🦄',
};

const ANIMAL_NAMES: Record<string, string> = {
  bear: '곰',
  tiger: '호랑이',
  eagle: '독수리',
  dragon: '드래곤',
  wolf: '늑대',
  fox: '여우',
  lion: '사자',
  shark: '상어',
  phoenix: '불사조',
  unicorn: '유니콘',
};

const TEAM_EMOJI: Record<string, string> = {
  LG: '🔴',
  KT: '⚫',
  SSG: '🔴',
  NC: '🟤',
  두산: '🐻',
  KIA: '🐯',
  롯데: '🔵',
  삼성: '🦁',
  한화: '🦅',
  키움: '🟣',
};

function getCharacterSize(xp: number): number {
  const size = 60 + Math.pow(xp, 0.55) * 7.5;
  return Math.round(Math.min(size, 300));
}

/* ───── 인터페이스 ───── */

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
  todayPlacement: {
    team: string;
    battingOrder: number;
    predictedWinner: string;
    status: string;
    isCorrect: boolean | null;
    xpFromPlayer: number | null;
    xpFromPrediction: number | null;
    game: {
      gameId: string;
      homeTeam: string;
      awayTeam: string;
      status: string;
      scores: any;
      startTime: string;
    } | null;
  } | null;
}

/* ───── 컴포넌트 ───── */

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useSession();
  const characterId = params.id as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 좋아요 상태
  const [liked, setLiked] = useState(false);
  const [totalLikes, setTotalLikes] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  // 밥주기 상태
  const [fed, setFed] = useState(false);
  const [feedAnimation, setFeedAnimation] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [totalFeeds, setTotalFeeds] = useState(0);
  const [remainingFeeds, setRemainingFeeds] = useState(3);

  // 배치 토글
  const [showPlacement, setShowPlacement] = useState(false);

  // 토스트
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  /* ───── 프로필 불러오기 ───── */

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/characters/${characterId}/public`,
        );
        if (!res.ok) {
          setError(true);
          return;
        }
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

  /* ───── 좋아요 상태 확인 ───── */

  useEffect(() => {
    if (!session || !characterId) return;
    const checkLikeStatus = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/characters/${characterId}/like-status`,
          {
            headers: { Authorization: `Bearer ${session.token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          setLiked(data.liked);
        }
      } catch (e) {
        console.error('Like status error:', e);
      }
    };
    checkLikeStatus();
  }, [session, characterId]);

  /* ───── 밥주기 상태 확인 ───── */

  useEffect(() => {
    if (!session || !characterId) return;
    const checkFeedStatus = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/characters/${characterId}/feed-status`,
          {
            headers: { Authorization: `Bearer ${session.token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          setFed(data.fed);
          setRemainingFeeds(data.remainingFeeds);
        }
      } catch (e) {
        console.error('Feed status error:', e);
      }
    };
    checkFeedStatus();
  }, [session, characterId]);

  /* ───── 좋아요 클릭 ───── */

  const handleLike = async () => {
    if (!session || liked || likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/characters/${characterId}/like`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
        },
      );
      const data = await res.json();
      if (res.ok) {
        setLiked(true);
        setTotalLikes(data.totalLikes);
        showToast('❤️ 좋아요를 보냈어요!');
      } else {
        if (data.code === 'alreadyLiked') setLiked(true);
        showToast(data.error || '좋아요 실패');
      }
    } catch (e) {
      showToast('네트워크 오류');
    } finally {
      setLikeLoading(false);
    }
  };

  /* ───── 밥주기 클릭 ───── */

  const handleFeed = async () => {
    if (!session || fed || feedLoading) return;
    setFeedLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/characters/${characterId}/feed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
        },
      );
      const data = await res.json();
      if (res.ok) {
        setFed(true);
        setTotalFeeds(data.totalFeeds);
        setRemainingFeeds(data.remainingFeeds ?? remainingFeeds);
        // 애니메이션 시작
        setFeedAnimation(true);
        setTimeout(() => setFeedAnimation(false), 1800);
        showToast(`🍖 밥을 줬어요! (-${data.cost} XP → +${data.given} XP)`);
      } else {
        if (data.code === 'alreadyFed') setFed(true);
        if (data.code === 'limitReached') setRemainingFeeds(0);
        showToast(data.error || '밥주기 실패');
      }
    } catch (e) {
      showToast('네트워크 오류');
    } finally {
      setFeedLoading(false);
    }
  };

  /* ───── 렌더링 ───── */

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
        <p className="text-gray-500 text-lg mb-4">
          캐릭터를 찾을 수 없습니다
        </p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-orange-400 text-white rounded-lg"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const { character, todayPlacement } = profile;
  const emoji = ANIMAL_EMOJI[character.animalType] || '🐾';
  const animalName = ANIMAL_NAMES[character.animalType] || character.animalType;
  const size = getCharacterSize(character.xp);

  const statusLabel = (status: string) => {
    switch (status) {
      case 'settled':
        return '정산 완료';
      case 'active':
        return '진행 중';
      case 'pending':
        return '대기 중';
      default:
        return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'settled':
        return 'bg-green-100 text-green-700';
      case 'active':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-20">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm z-50 animate-bounce">
          {toast}
        </div>
      )}

      {/* 밥 먹는 애니메이션 */}
      {feedAnimation && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {['🍖', '🥩', '🍗'].map((food, i) => (
            <div
              key={i}
              className="absolute text-3xl"
              style={{
                left: `${30 + i * 20}%`,
                animation: `feedFly${i} 1.5s ease-in forwards`,
              }}
            >
              {food}
            </div>
          ))}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 text-2xl font-bold text-orange-500"
            style={{ animation: 'nomnom 1.5s ease-out forwards' }}
          >
            냠냠!
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="sticky top-0 bg-white/80 backdrop-blur border-b border-orange-100 px-4 py-3 flex items-center z-40">
        <button
          onClick={() => router.back()}
          className="text-gray-500 text-lg mr-3"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-800">
          {character.name}의 프로필
        </h1>
      </div>

      {/* 캐릭터 영역 */}
      <div className="flex flex-col items-center pt-10 pb-6">
        <div
          className="flex items-center justify-center"
          style={{ fontSize: `${size}px`, lineHeight: 1 }}
        >
          {emoji}
        </div>
        <h2 className="text-xl font-bold text-gray-800 mt-4">
          {character.name}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {animalName} · {character.xp.toLocaleString()} XP
        </p>
        {character.streak > 0 && (
          <p className="text-xs text-orange-400 mt-1">
            🔥 {character.streak}일 연속
          </p>
        )}
        {character.activeTrait && (
          <div className="mt-2 bg-white/80 backdrop-blur rounded-xl px-3 py-1.5 border border-orange-100 shadow-sm">
            <p className="text-sm text-gray-700">{character.activeTrait}</p>
          </div>
        )}

        {/* 좋아요 & 밥 카운트 */}
        <div className="flex items-center gap-4 mt-3">
          {totalLikes > 0 && (
            <span className="text-sm text-pink-400">❤️ {totalLikes}</span>
          )}
          {totalFeeds > 0 && (
            <span className="text-sm text-orange-400">🍖 {totalFeeds}</span>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      {session && (
        <div className="flex justify-center gap-3 px-6 mb-6">
          {/* 좋아요 버튼 */}
          <button
            onClick={handleLike}
            disabled={liked || likeLoading}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              liked
                ? 'bg-pink-100 text-pink-400 cursor-not-allowed'
                : 'bg-white text-pink-500 border-2 border-pink-300 hover:bg-pink-50 active:scale-95 shadow-sm'
            }`}
          >
            {liked ? '❤️' : '🤍'} {liked ? '좋아요 완료' : '좋아요'}
          </button>

          {/* 밥주기 버튼 */}
          <button
            onClick={handleFeed}
            disabled={fed || feedLoading}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              fed
                ? 'bg-orange-100 text-orange-400 cursor-not-allowed'
                : 'bg-orange-400 text-white hover:bg-orange-500 active:scale-95 shadow-md'
            }`}
          >
            🍖 {fed ? '밥 완료' : '밥주기'}
            {!fed && <span className="text-xs opacity-70">(-5 XP)</span>}
          </button>
        </div>
      )}

      {/* 오늘의 배치 토글 */}
      <div className="px-6">
        <button
          onClick={() => setShowPlacement(!showPlacement)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-orange-100 flex items-center justify-between"
        >
          <span className="text-sm font-bold text-gray-700">
            📋 오늘의 배치
          </span>
          <span className="text-gray-400 text-lg">
            {showPlacement ? '▲' : '▼'}
          </span>
        </button>

        {showPlacement && (
          <div className="mt-2 bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
            {todayPlacement ? (
              <div className="space-y-3">
                {/* 경기 정보 */}
                {todayPlacement.game && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-3 text-lg font-bold">
                      <span>
                        {TEAM_EMOJI[todayPlacement.game.homeTeam] || '⚾'}{' '}
                        {todayPlacement.game.homeTeam}
                      </span>
                      <span className="text-gray-300">vs</span>
                      <span>
                        {todayPlacement.game.awayTeam}{' '}
                        {TEAM_EMOJI[todayPlacement.game.awayTeam] || '⚾'}
                      </span>
                    </div>
                    {todayPlacement.game.scores && (
                      <p className="text-sm text-gray-500 mt-1">
                        {todayPlacement.game.scores.home ?? '?'} :{' '}
                        {todayPlacement.game.scores.away ?? '?'}
                      </p>
                    )}
                  </div>
                )}

                {/* 배치 상세 */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">배치 팀</p>
                    <p className="font-bold">
                      {TEAM_EMOJI[todayPlacement.team] || ''}{' '}
                      {todayPlacement.team}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">타순</p>
                    <p className="font-bold">{todayPlacement.battingOrder}번</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">예측 승리</p>
                    <p className="font-bold">
                      {TEAM_EMOJI[todayPlacement.predictedWinner] || ''}{' '}
                      {todayPlacement.predictedWinner}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">상태</p>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(todayPlacement.status)}`}
                    >
                      {statusLabel(todayPlacement.status)}
                    </span>
                  </div>
                </div>

                {/* XP (정산 완료 시) */}
                {todayPlacement.status === 'settled' && (
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400">획득 XP</p>
                    <p className="text-lg font-bold text-orange-500">
                      +
                      {(
                        (todayPlacement.xpFromPlayer || 0) +
                        (todayPlacement.xpFromPrediction || 0)
                      ).toLocaleString()}{' '}
                      XP
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-4">
                오늘 아직 배치하지 않았어요
              </p>
            )}
          </div>
        )}
      </div>

      {/* 향후 확장 영역 */}
      <div className="px-6 mt-4 space-y-3">
        <div className="bg-white/50 rounded-2xl p-4 border border-dashed border-orange-200 text-center">
          <p className="text-sm text-gray-400">📝 방명록 (곧 추가 예정)</p>
        </div>
      </div>

      {/* CSS 애니메이션 */}
      <style jsx global>{`
        @keyframes feedFly0 {
          0% {
            top: 80%;
            opacity: 1;
            transform: scale(1);
          }
          80% {
            top: 40%;
            opacity: 1;
            transform: scale(1.3);
          }
          100% {
            top: 35%;
            opacity: 0;
            transform: scale(0.5);
          }
        }
        @keyframes feedFly1 {
          0% {
            top: 85%;
            opacity: 1;
            transform: scale(1);
          }
          80% {
            top: 42%;
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            top: 37%;
            opacity: 0;
            transform: scale(0.5);
          }
        }
        @keyframes feedFly2 {
          0% {
            top: 82%;
            opacity: 1;
            transform: scale(1);
          }
          80% {
            top: 38%;
            opacity: 1;
            transform: scale(1.4);
          }
          100% {
            top: 33%;
            opacity: 0;
            transform: scale(0.5);
          }
        }
        @keyframes nomnom {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.5);
          }
          30% {
            opacity: 1;
            transform: translate(-50%, -20px) scale(1.2);
          }
          60% {
            opacity: 1;
            transform: translate(-50%, -30px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50px) scale(0.8);
          }
        }
      `}</style>
    </div>
  );
}
