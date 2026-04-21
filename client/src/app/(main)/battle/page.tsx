'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface MatchResult {
  myHits: number;
  myHomeRuns: number;
  myRuns: number;
  oppRuns: number;
  mvp: boolean;
  win: boolean;
}

interface DroppedItem {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  slot: string;
  effect: { stat?: string; value: number; xpBonus?: number };
}

interface MatchResponse {
  matchId: string;
  result: MatchResult;
  xpReward: number;
  droppedItem: DroppedItem | null;
  remaining: number;
  currentXp: number;
  totalXp: number;
}

interface MatchStatus {
  played: number;
  maxMatches: number;
  remaining: number;
  hasPrediction: boolean;
}

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-gray-100 text-gray-600 border-gray-200',
  rare: 'bg-blue-50 text-blue-600 border-blue-200',
  epic: 'bg-purple-50 text-purple-600 border-purple-200',
  legendary: 'bg-yellow-50 text-yellow-600 border-yellow-300',
};

const RARITY_NAMES: Record<string, string> = {
  common: '일반', rare: '레어', epic: '에픽', legendary: '전설',
};

export default function BattlePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [animStep, setAnimStep] = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (token) fetchStatus();
  }, [token, authStatus]);

  async function fetchStatus() {
    try {
      const res = await fetch(`${apiUrl}/api/virtual-match/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMatchStatus(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handlePlay() {
    if (playing || !matchStatus || matchStatus.remaining <= 0) return;
    setPlaying(true);
    setResult(null);
    setShowResult(false);
    setAnimStep(1);

    // 경기 진행 애니메이션
    await new Promise(r => setTimeout(r, 800));
    setAnimStep(2);
    await new Promise(r => setTimeout(r, 800));
    setAnimStep(3);
    await new Promise(r => setTimeout(r, 600));

    try {
      const res = await fetch(`${apiUrl}/api/virtual-match/play`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setShowResult(true);
        setMatchStatus(prev => prev ? {
          ...prev,
          played: prev.played + 1,
          remaining: data.remaining,
        } : prev);
      } else {
        alert(data.error || '경기 실패');
      }
    } catch {
      alert('네트워크 오류');
    } finally {
      setPlaying(false);
      setAnimStep(0);
    }
  }

  if (loading || authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-4">
        <h1 className="text-lg font-bold text-gray-900">⚾ 경기 뛰기</h1>
        <p className="text-xs text-gray-400 mt-1">캐릭터 능력치로 가상 경기를 뛰어보세요!</p>
      </div>

      {/* 상태 표시 */}
      {matchStatus && (
        <div className="px-4 pt-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">오늘 남은 횟수</span>
              <span className="text-lg font-bold text-orange-500">{matchStatus.remaining} / {matchStatus.maxMatches}</span>
            </div>
            {!matchStatus.hasPrediction && matchStatus.remaining <= 1 && (
              <div className="bg-orange-50 rounded-xl px-3 py-2 mt-2">
                <p className="text-xs text-orange-600">💡 오늘 경기 예측하면 추가 1회 가능!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 경기 진행 애니메이션 */}
      {playing && (
        <div className="px-4 pt-8">
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
            <div className="text-5xl mb-4">
              {animStep === 1 && '⚾'}
              {animStep === 2 && '🏏'}
              {animStep === 3 && '🏃'}
            </div>
            <p className="text-sm font-bold text-gray-600">
              {animStep === 1 && '투수가 공을 던집니다...'}
              {animStep === 2 && '배트를 휘두릅니다!'}
              {animStep === 3 && '경기 결과 집계 중...'}
            </p>
          </div>
        </div>
      )}

      {/* 결과 표시 */}
      {showResult && result && (
        <div className="px-4 pt-4 space-y-3">
          {/* 승패 */}
          <div className={`rounded-2xl p-6 text-center border-2 ${
            result.result.win ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
          }`}>
            <div className="text-4xl mb-2">{result.result.mvp ? '🏆' : result.result.win ? '✅' : '❌'}</div>
            <h2 className={`text-xl font-bold ${result.result.win ? 'text-green-600' : 'text-red-600'}`}>
              {result.result.mvp ? 'MVP 승리!' : result.result.win ? '승리!' : '패배...'}
            </h2>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {result.result.myRuns} : {result.result.oppRuns}
            </p>
          </div>

          {/* 스탯 */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">안타</p>
                <p className="text-lg font-bold text-gray-800">{result.result.myHits}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">홈런</p>
                <p className="text-lg font-bold text-gray-800">{result.result.myHomeRuns}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">XP 획득</p>
                <p className="text-lg font-bold text-orange-500">+{result.xpReward}</p>
              </div>
            </div>
          </div>

          {/* 아이템 드롭 */}
          {result.droppedItem && (
            <div className={`rounded-2xl p-4 border-2 ${RARITY_COLORS[result.droppedItem.rarity] || 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{result.droppedItem.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{result.droppedItem.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/50 font-medium">
                      {RARITY_NAMES[result.droppedItem.rarity] || result.droppedItem.rarity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {result.droppedItem.effect.stat} +{result.droppedItem.effect.value}
                    {result.droppedItem.effect.xpBonus ? ` · XP +${result.droppedItem.effect.xpBonus}%` : ''}
                  </p>
                </div>
                <span className="text-xl">🎁</span>
              </div>
            </div>
          )}

          {!result.droppedItem && (
            <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
              <p className="text-xs text-gray-400">아이템이 드롭되지 않았습니다</p>
            </div>
          )}

          {/* XP 현황 */}
          <div className="bg-orange-50 rounded-2xl p-3 border border-orange-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">보유 XP</span>
              <span className="font-bold text-orange-600">{result.currentXp.toLocaleString()} XP</span>
            </div>
          </div>
        </div>
      )}

      {/* 플레이 버튼 */}
      {!playing && (
        <div className="px-4 pt-6">
          <button
            onClick={handlePlay}
            disabled={!matchStatus || matchStatus.remaining <= 0}
            className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
              matchStatus && matchStatus.remaining > 0
                ? 'bg-orange-400 text-white active:scale-[0.98] shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {matchStatus && matchStatus.remaining <= 0
              ? '오늘 경기 완료!'
              : '⚾ 경기 시작!'}
          </button>
        </div>
      )}

      {/* 다시 하기 */}
      {showResult && matchStatus && matchStatus.remaining > 0 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => { setShowResult(false); setResult(null); }}
            className="w-full py-3 rounded-2xl text-sm font-bold bg-white border border-orange-300 text-orange-500"
          >
            한 번 더! ({matchStatus.remaining}회 남음)
          </button>
        </div>
      )}
    </div>
  );
}
