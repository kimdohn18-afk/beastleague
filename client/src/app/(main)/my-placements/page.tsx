'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BatterRecord {
  order: string;
  position: string;
  name: string;
  atBats: string;
  hits: string;
  rbi: string;
  runs: string;
  avg: string;
}

interface Placement {
  _id: string;
  gameId: string;
  team: string;
  battingOrder: number;
  predictedWinner: string;
  date: string;
  status: 'pending' | 'active' | 'settled';
  isCorrect?: boolean;
  xpFromPlayer: number;
  xpFromPrediction: number;
  xpBreakdown?: {
    hits: number;
    rbi: number;
    runs: number;
    noHitPenalty: number;
    homeRun: number;
    double: number;
    triple: number;
    stolenBase: number;
    caughtStealing: number;
    walkOff: number;
    teamResult: number;
    total: number;
  };
  game?: {
    homeTeam: string;
    awayTeam: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
    batterRecords?: {
      away: BatterRecord[];
      home: BatterRecord[];
    };
  };
}

const XP_LABELS: Record<string, string> = {
  hits: '안타',
  rbi: '타점',
  runs: '득점',
  homeRun: '홈런',
  double: '2루타',
  triple: '3루타',
  stolenBase: '도루',
  caughtStealing: '도루실패',
  noHitPenalty: '무안타',
  walkOff: '끝내기',
};

function getMyBatters(p: Placement): BatterRecord[] {
  if (!p.game?.batterRecords) return [];
  const isHome = p.team === p.game.homeTeam;
  const batters = isHome ? p.game.batterRecords.home : p.game.batterRecords.away;
  if (!batters) return [];

  const orderStr = String(p.battingOrder);
  const result: BatterRecord[] = [];

  for (let i = 0; i < batters.length; i++) {
    if (batters[i].order === orderStr) {
      result.push(batters[i]);
      for (let j = i + 1; j < batters.length; j++) {
        if (batters[j].order === '') {
          result.push(batters[j]);
        } else {
          break;
        }
      }
      break;
    }
  }
  return result;
}

export default function MyPlacementsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'history' | 'season'>('history');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = (session as any)?.backendToken || (session as any)?.accessToken;

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
    if (!token) return;
    fetchHistory();
  }, [token, authStatus]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/placements/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPlacements(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const settled = placements.filter((p) => p.status === 'settled');
  const totalXp = settled.reduce((s, p) => s + p.xpFromPlayer + p.xpFromPrediction, 0);
  const correctCount = settled.filter((p) => p.isCorrect).length;
  const accuracy = settled.length > 0 ? Math.round((correctCount / settled.length) * 100) : 0;

  // 시즌 합산 계산
  const seasonStats = settled.reduce(
    (acc, p) => {
      const batters = getMyBatters(p);
      for (const b of batters) {
        acc.atBats += parseInt(b.atBats) || 0;
        acc.hits += parseInt(b.hits) || 0;
        acc.rbi += parseInt(b.rbi) || 0;
        acc.runs += parseInt(b.runs) || 0;
      }
      if (p.xpBreakdown) {
        acc.homeRun += p.xpBreakdown.homeRun / 40 || 0;
        acc.double += p.xpBreakdown.double / 12 || 0;
        acc.triple += p.xpBreakdown.triple / 20 || 0;
        acc.stolenBase += p.xpBreakdown.stolenBase / 15 || 0;
        acc.caughtStealing += Math.abs(p.xpBreakdown.caughtStealing / 10) || 0;
        acc.walkOff += p.xpBreakdown.walkOff / 25 || 0;
        acc.noHitGames += p.xpBreakdown.noHitPenalty < 0 ? 1 : 0;
        acc.teamWins += p.xpBreakdown.teamResult > 0 ? 1 : 0;
      }
      acc.totalXp += p.xpFromPlayer + p.xpFromPrediction;
      return acc;
    },
    {
      atBats: 0, hits: 0, rbi: 0, runs: 0,
      homeRun: 0, double: 0, triple: 0,
      stolenBase: 0, caughtStealing: 0, walkOff: 0,
      noHitGames: 0, teamWins: 0, totalXp: 0,
    }
  );
  const seasonAvg = seasonStats.atBats > 0
    ? (seasonStats.hits / seasonStats.atBats).toFixed(3)
    : '.000';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 상단 통계 */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
        <h1 className="text-gray-900 text-lg font-bold mb-4">내 배치</h1>
        <div className="flex gap-3">
          <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">총 획득 XP</p>
            <p className="text-orange-500 text-2xl font-bold">{totalXp}</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">승리 예측</p>
            <p className="text-emerald-500 text-2xl font-bold">{correctCount}/{settled.length}</p>
          </div>
          <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs mb-1">적중률</p>
            <p className="text-blue-500 text-2xl font-bold">{accuracy}%</p>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 flex">
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
            tab === 'history'
              ? 'text-orange-500 border-b-2 border-orange-400'
              : 'text-gray-400'
          }`}
        >
          경기별 기록
        </button>
        <button
          onClick={() => setTab('season')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
            tab === 'season'
              ? 'text-orange-500 border-b-2 border-orange-400'
              : 'text-gray-400'
          }`}
        >
          시즌 성적
        </button>
      </div>

      {/* 시즌 성적 탭 */}
      {tab === 'season' && (
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 타율 대형 표시 */}
            <div className="p-6 text-center border-b border-gray-100">
              <p className="text-gray-400 text-xs mb-1">시즌 타율</p>
              <p className="text-4xl font-bold text-gray-900">{seasonAvg}</p>
              <p className="text-gray-400 text-xs mt-2">{settled.length}경기 참여</p>
            </div>

            {/* 주요 기록 */}
            <div className="grid grid-cols-3 border-b border-gray-100">
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">타수</p>
                <p className="text-lg font-bold text-gray-900">{seasonStats.atBats}</p>
              </div>
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">안타</p>
                <p className="text-lg font-bold text-gray-900">{seasonStats.hits}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-gray-400 text-[10px] mb-1">홈런</p>
                <p className="text-lg font-bold text-gray-900">{Math.round(seasonStats.homeRun)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 border-b border-gray-100">
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">타점</p>
                <p className="text-lg font-bold text-gray-900">{seasonStats.rbi}</p>
              </div>
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">득점</p>
                <p className="text-lg font-bold text-gray-900">{seasonStats.runs}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-gray-400 text-[10px] mb-1">도루</p>
                <p className="text-lg font-bold text-gray-900">{Math.round(seasonStats.stolenBase)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 border-b border-gray-100">
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">2루타</p>
                <p className="text-lg font-bold text-gray-900">{Math.round(seasonStats.double)}</p>
              </div>
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">3루타</p>
                <p className="text-lg font-bold text-gray-900">{Math.round(seasonStats.triple)}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-gray-400 text-[10px] mb-1">끝내기</p>
                <p className="text-lg font-bold text-gray-900">{Math.round(seasonStats.walkOff)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3">
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">도루실패</p>
                <p className="text-lg font-bold text-red-400">{Math.round(seasonStats.caughtStealing)}</p>
              </div>
              <div className="p-4 text-center border-r border-gray-100">
                <p className="text-gray-400 text-[10px] mb-1">무안타 경기</p>
                <p className="text-lg font-bold text-red-400">{seasonStats.noHitGames}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-gray-400 text-[10px] mb-1">팀 승리</p>
                <p className="text-lg font-bold text-emerald-500">{seasonStats.teamWins}</p>
              </div>
            </div>

            {/* XP 합산 */}
            <div className="border-t border-gray-100 p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm font-medium">시즌 총 XP</span>
                <span className="text-orange-500 text-xl font-bold">+{seasonStats.totalXp}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 경기별 기록 탭 */}
      {tab === 'history' && (
        <div className="p-4 space-y-3">
          {placements.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 mb-4">아직 배치 기록이 없습니다</p>
              <button
                onClick={() => router.push('/match')}
                className="bg-orange-400 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
              >
                경기 배치하러 가기
              </button>
            </div>
          ) : (
            placements.map((p) => {
              const isSettled = p.status === 'settled';
              const totalXpItem = p.xpFromPlayer + p.xpFromPrediction;
              const isPositive = totalXpItem >= 0;
              const isExpanded = expandedId === p._id;
              const matchLabel = p.game
                ? `${p.game.awayTeam} vs ${p.game.homeTeam}`
                : p.gameId;
              const myBatters = getMyBatters(p);
              const predictionXp = (p.xpBreakdown?.teamResult ?? 0) + p.xpFromPrediction;

              return (
                <div key={p._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400 text-xs">{p.date}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isSettled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {isSettled ? '정산완료' : '진행중'}
                      </span>
                    </div>

                    <p className="font-semibold text-gray-900 mb-1">{matchLabel}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full">
                        {p.team}
                      </span>
                      <span className="text-gray-600 text-sm">{p.battingOrder}번 타자</span>
                      <span className="text-gray-400 text-xs">· {p.predictedWinner} 승리 예측</span>
                    </div>

                    {isSettled && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`text-lg font-bold ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{totalXpItem} XP
                        </span>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : p._id)}
                          className="text-xs text-gray-400 underline"
                        >
                          {isExpanded ? '접기' : '상세보기'}
                        </button>
                      </div>
                    )}

                    {!isSettled && (
                      <button
                        onClick={() => router.push('/match')}
                        className="mt-3 text-xs text-blue-500 underline"
                      >
                        수정하기
                      </button>
                    )}
                  </div>

                  {/* 상세 펼침 */}
                  {isExpanded && isSettled && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">

                      {/* 선수 실제 성적 */}
                      {myBatters.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 mb-2">선수 성적</p>
                          {myBatters.map((b, i) => (
                            <div key={i} className="bg-white rounded-xl p-3 mb-1 border border-gray-100">
                              <p className="text-sm font-bold text-gray-900 mb-1">
                                {b.name}
                                <span className="text-xs text-gray-400 font-normal ml-2">{b.position}</span>
                              </p>
                              <div className="flex gap-3 text-xs text-gray-600">
                                <span>{b.atBats}타수</span>
                                <span className="font-semibold text-gray-900">{b.hits}안타</span>
                                <span>{b.rbi}타점</span>
                                <span>{b.runs}득점</span>
                                <span>타율 {b.avg}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* XP 상세 */}
                      {p.xpBreakdown && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">XP 상세</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            {Object.entries(XP_LABELS).map(([key, label]) => {
                              const val = (p.xpBreakdown as any)[key];
                              if (!val || val === 0) return null;
                              const isNeg = val < 0;
                              return (
                                <div key={key} className="flex justify-between">
                                  <span className="text-gray-500">{label}</span>
                                  <span className={`font-medium ${isNeg ? 'text-red-400' : 'text-gray-700'}`}>
                                    {isNeg ? '' : '+'}{val}
                                  </span>
                                </div>
                              );
                            })}
                            {predictionXp !== 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">승리 예측</span>
                                <span className="font-medium text-gray-700">+{predictionXp}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-bold">
                            <span className="text-gray-700">합계</span>
                            <span className={isPositive ? 'text-emerald-500' : 'text-red-400'}>
                              {isPositive ? '+' : ''}{totalXpItem} XP
                            </span>
                          </div>
                          {p.isCorrect !== undefined && (
                            <div className="mt-1 flex items-center gap-1">
                              <span className={p.isCorrect ? 'text-emerald-500' : 'text-red-400'}>
                                {p.isCorrect ? '✓' : '✗'}
                              </span>
                              <span className="text-gray-400 text-xs">
                                예측: {p.predictedWinner} {p.isCorrect ? '적중!' : '실패'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
