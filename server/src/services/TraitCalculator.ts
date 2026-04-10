import { Placement, IPlacement } from '../models/Placement';
import { Game } from '../models/Game';
import { Character, ICharacter } from '../models/Character';

export interface BadgeDefinition {
  id: string;
  emoji: string;
  name: string;
  category: 'achievement' | 'batting' | 'team' | 'streak' | 'special';
  description: string;
  check: (ctx: TraitContext) => boolean;
}

export interface TraitContext {
  recent10: IPlacement[];
  prev10: IPlacement[];
  allPlacements: IPlacement[];
  character: ICharacter;
  // 사전 계산된 통계
  recent10Correct: number;
  recent10Total: number;
  recentTeams: Map<string, number>;
  recentOrders: Map<number, number>;
  recentHomeCount: number;
  recentAwayCount: number;
  allTeams: Set<string>;
  allOrders: Set<number>;
  // 누적 XP 항목별 발생 횟수
  cumulativeHomeRuns: number;
  cumulativeStolenBases: number;
  cumulativeWalkOffs: number;
  cumulativeCaughtStealing: number;
  cumulativeNoHitPenalty: number;
  // 최근 10회 XP 항목별 발생 횟수
  recentHitsCount: number;
  recentRbiCount: number;
  recentRunsCount: number;
  // 최근 10회 XP 합계
  recentXpSum: number;
  prevXpSum: number;
  // 단일 배치 최대 XP
  maxSingleXp: number;
  // 현재 획득 뱃지 수
  currentBadgeCount: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── 🏆 성과 (실력 기반) — 12개 ──
  {
    id: 'prophet',
    emoji: '🔮',
    name: '예언자',
    category: 'achievement',
    description: '경기의 흐름을 읽는 자',
    check: (ctx) => ctx.recent10Total >= 10 && ctx.recent10Correct / ctx.recent10Total >= 0.7,
  },
  {
    id: 'oracle',
    emoji: '🔮',
    name: '신탁',
    category: 'achievement',
    description: '거의 틀리지 않는 경지',
    check: (ctx) => ctx.recent10Total >= 10 && ctx.recent10Correct / ctx.recent10Total >= 0.9,
  },
  {
    id: 'hr_hunter',
    emoji: '💣',
    name: '홈런 헌터',
    category: 'achievement',
    description: '한두 번이 아니다, 대포 노선',
    check: (ctx) => ctx.cumulativeHomeRuns >= 5,
  },
  {
    id: 'hr_master',
    emoji: '💥',
    name: '홈런 마스터',
    category: 'achievement',
    description: '홈런 타순을 꿰뚫는 경지',
    check: (ctx) => ctx.cumulativeHomeRuns >= 15,
  },
  {
    id: 'speedster',
    emoji: '🏃',
    name: '스피드스터',
    category: 'achievement',
    description: '빠른 선수를 찾는 감각',
    check: (ctx) => ctx.cumulativeStolenBases >= 5,
  },
  {
    id: 'hit_machine',
    emoji: '🛡️',
    name: '안타 제조기',
    category: 'achievement',
    description: '거의 매번 안타가 나온다',
    check: (ctx) => ctx.recentHitsCount >= 8,
  },
  {
    id: 'rbi_collector',
    emoji: '🎯',
    name: '타점 수집가',
    category: 'achievement',
    description: '타점이 꾸준히 따라오는 선구안',
    check: (ctx) => ctx.recentRbiCount >= 7,
  },
  {
    id: 'reverse_prophet',
    emoji: '🎰',
    name: '역예측왕',
    category: 'achievement',
    description: '예측은 빗나가도 배치는 계속된다',
    check: (ctx) => ctx.recent10Total >= 10 && ctx.recent10Correct / ctx.recent10Total <= 0.2,
  },
  {
    id: 'run_radar',
    emoji: '🏅',
    name: '득점 레이더',
    category: 'achievement',
    description: '득점 냄새를 맡는 자',
    check: (ctx) => ctx.recentRunsCount >= 7,
  },
  {
    id: 'walkoff_magnet',
    emoji: '🔗',
    name: '끝내기 체질',
    category: 'achievement',
    description: '끝내기를 부르는 손',
    check: (ctx) => ctx.cumulativeWalkOffs >= 3,
  },
  {
    id: 'caught_stealing_king',
    emoji: '⚠️',
    name: '도루 실패왕',
    category: 'achievement',
    description: '도전은 했지만 결과는...',
    check: (ctx) => ctx.cumulativeCaughtStealing >= 3,
  },
  {
    id: 'nohit_survivor',
    emoji: '📊',
    name: '무안타 서바이버',
    category: 'achievement',
    description: '바닥을 찍고도 살아남았다',
    check: (ctx) => ctx.cumulativeNoHitPenalty >= 5 && ctx.character.xp > 0,
  },

  // ── ⚾ 타순 전략 — 8개 ──
  {
    id: 'leadoff_maniac',
    emoji: '⚡',
    name: '리드오프 마니아',
    category: 'batting',
    description: '시작은 1번 타자부터',
    check: (ctx) => (ctx.recentOrders.get(1) || 0) / ctx.recent10Total >= 0.5,
  },
  {
    id: 'cleanup_killer',
    emoji: '🔨',
    name: '클린업 킬러',
    category: 'batting',
    description: '중심타선만 노린다',
    check: (ctx) => {
      const c = (ctx.recentOrders.get(3) || 0) + (ctx.recentOrders.get(4) || 0) + (ctx.recentOrders.get(5) || 0);
      return c / ctx.recent10Total >= 0.7;
    },
  },
  {
    id: 'lower_gambler',
    emoji: '🔧',
    name: '하위타선 도박사',
    category: 'batting',
    description: '남들이 안 보는 곳에서 XP를 캔다',
    check: (ctx) => {
      const c = (ctx.recentOrders.get(7) || 0) + (ctx.recentOrders.get(8) || 0) + (ctx.recentOrders.get(9) || 0);
      return c / ctx.recent10Total >= 0.5;
    },
  },
  {
    id: 'order_nomad',
    emoji: '🎪',
    name: '타순 유목민',
    category: 'batting',
    description: '매번 다른 타순에 도전',
    check: (ctx) => ctx.recentOrders.size >= 7,
  },
  {
    id: 'four_obsession',
    emoji: '4️⃣',
    name: '4번 집착',
    category: 'batting',
    description: '4번이 아니면 배치가 아니다',
    check: (ctx) => (ctx.recentOrders.get(4) || 0) / ctx.recent10Total >= 0.6,
  },
  {
    id: 'full_count',
    emoji: '🔄',
    name: '풀카운트',
    category: 'batting',
    description: '모든 타순을 경험한 탐험가',
    check: (ctx) => ctx.allOrders.size >= 9,
  },
  {
    id: 'second_artisan',
    emoji: '2️⃣',
    name: '2번 장인',
    category: 'batting',
    description: '연결 타순의 미학',
    check: (ctx) => (ctx.recentOrders.get(2) || 0) / ctx.recent10Total >= 0.5,
  },
  {
    id: 'odd_even_master',
    emoji: '🎲',
    name: '홀짝 마스터',
    category: 'batting',
    description: '본인만의 규칙이 있다',
    check: (ctx) => {
      const orders = ctx.recent10.map(p => p.battingOrder);
      const allOdd = orders.every(o => o % 2 === 1);
      const allEven = orders.every(o => o % 2 === 0);
      return orders.length >= 10 && (allOdd || allEven);
    },
  },

  // ── ❤️ 팀 성향 — 7개 ──
  {
    id: 'one_team',
    emoji: '❤️',
    name: '원팀 충성파',
    category: 'team',
    description: '한 팀만을 위한 배치',
    check: (ctx) => {
      const max = Math.max(...ctx.recentTeams.values());
      return max / ctx.recent10Total >= 0.8;
    },
  },
  {
    id: 'team_explorer',
    emoji: '🎲',
    name: '팀 탐험가',
    category: 'team',
    description: '오늘은 어디에 배치할까',
    check: (ctx) => ctx.recentTeams.size >= 5,
  },
  {
    id: 'all_team_conqueror',
    emoji: '🗺️',
    name: '전팀 정복자',
    category: 'team',
    description: 'KBO 전 구단을 경험한 자',
    check: (ctx) => ctx.allTeams.size >= 10,
  },
  {
    id: 'home_maniac',
    emoji: '🏠',
    name: '홈 매니아',
    category: 'team',
    description: '홈 어드밴티지를 믿는다',
    check: (ctx) => ctx.recent10Total >= 10 && ctx.recentHomeCount / ctx.recent10Total >= 0.8,
  },
  {
    id: 'away_expert',
    emoji: '✈️',
    name: '원정 전문가',
    category: 'team',
    description: '원정의 긴장감을 즐기는 자',
    check: (ctx) => ctx.recent10Total >= 10 && ctx.recentAwayCount / ctx.recent10Total >= 0.8,
  },
  {
    id: 'drifter',
    emoji: '🔀',
    name: '승부사',
    category: 'team',
    description: '한 곳에 정착하지 않는다',
    check: (ctx) => ctx.recent10Total >= 10 && ctx.recentTeams.size >= 10,
  },
  {
    id: 'tragic_fan',
    emoji: '💔',
    name: '비운의 팬',
    category: 'team',
    description: '사랑하지만 승리가 따르지 않는다',
    check: (ctx) => {
      const max = Math.max(...ctx.recentTeams.values());
      const isLoyal = max / ctx.recent10Total >= 0.8;
      const lowAccuracy = ctx.recent10Total >= 10 && ctx.recent10Correct / ctx.recent10Total <= 0.3;
      return isLoyal && lowAccuracy;
    },
  },

  // ── 🔥 연속성 / 끈기 — 7개 ──
  {
    id: 'sprout',
    emoji: '🌱',
    name: '새싹',
    category: 'streak',
    description: '여정의 시작',
    check: (ctx) => ctx.allPlacements.length >= 1,
  },
  {
    id: 'ten_milestone',
    emoji: '🐣',
    name: '10회 돌파',
    category: 'streak',
    description: '이제 진짜 시작이다',
    check: (ctx) => ctx.character.totalPlacements >= 10,
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    name: '연속 배치왕',
    category: 'streak',
    description: '일주일을 불태우다',
    check: (ctx) => ctx.character.streak >= 7,
  },
  {
    id: 'streak_14',
    emoji: '🔥',
    name: '불꽃 투혼',
    category: 'streak',
    description: '2주 연속, 멈출 수 없다',
    check: (ctx) => ctx.character.streak >= 14,
  },
  {
    id: 'streak_30',
    emoji: '👑',
    name: '철인',
    category: 'streak',
    description: '한 달을 관통하는 집념',
    check: (ctx) => ctx.character.streak >= 30,
  },
  {
    id: 'attendance_50',
    emoji: '📅',
    name: '개근상',
    category: 'streak',
    description: '50번의 배치를 넘긴 베테랑',
    check: (ctx) => ctx.character.totalPlacements >= 50,
  },
  {
    id: 'veteran_100',
    emoji: '🎖️',
    name: '백전노장',
    category: 'streak',
    description: '100번의 전장을 거친 자',
    check: (ctx) => ctx.character.totalPlacements >= 100,
  },

  // ── 💎 특수 / 희귀 — 8개 ──
  {
    id: 'allrounder',
    emoji: '💎',
    name: '올라운더',
    category: 'special',
    description: '균형 잡힌 배치의 달인',
    check: (ctx) => {
      const counts = [ctx.recentHitsCount, ctx.recentRbiCount, ctx.recentRunsCount];
      const active = counts.filter(c => c >= 3);
      return active.length >= 3;
    },
  },
  {
    id: 'path_of_pain',
    emoji: '💀',
    name: '수라의 길',
    category: 'special',
    description: '고통 속에서 단련되는 자',
    check: (ctx) => ctx.recentXpSum < 0,
  },
  {
    id: 'xp_explosion',
    emoji: '🌟',
    name: 'XP 폭발',
    category: 'special',
    description: '전설적인 한 판',
    check: (ctx) => ctx.maxSingleXp >= 100,
  },
  {
    id: 'growth_curve',
    emoji: '📈',
    name: '성장 곡선',
    category: 'special',
    description: '눈에 띄게 성장하는 중',
    check: (ctx) => ctx.prevXpSum > 0 && ctx.recentXpSum > ctx.prevXpSum * 1.5,
  },
  {
    id: 'collector',
    emoji: '🏆',
    name: '컬렉터',
    category: 'special',
    description: '뱃지 수집가 그 자체',
    check: (ctx) => ctx.currentBadgeCount >= 25,
  },
  {
    id: 'rollercoaster',
    emoji: '🎭',
    name: '반전왕',
    category: 'special',
    description: '천국과 지옥을 오가는 자',
    check: (ctx) => {
      if (ctx.recent10.length < 10) return false;
      const xps = ctx.recent10.map(p => (p.xpFromPlayer || 0) + (p.xpFromPrediction || 0));
      return Math.max(...xps) - Math.min(...xps) >= 100;
    },
  },
  {
    id: 'consistency',
    emoji: '🧊',
    name: '꾸준함의 미학',
    category: 'special',
    description: '극적이진 않지만 절대 무너지지 않는다',
    check: (ctx) => {
      if (ctx.recent10.length < 10) return false;
      const xps = ctx.recent10.map(p => (p.xpFromPlayer || 0) + (p.xpFromPrediction || 0));
      return xps.every(x => x >= 20 && x <= 60);
    },
  },
  {
    id: 'grand_slam',
    emoji: '🎯',
    name: '만루 홈런급',
    category: 'special',
    description: '역대급 한 판을 기록한 자',
    check: (ctx) => ctx.maxSingleXp >= 150,
  },
];

// 희귀도 순서 (뒤에 있을수록 희귀 = 대표 칭호 우선순위 높음)
const RARITY_ORDER: string[] = [
  'sprout', 'ten_milestone',
  'reverse_prophet', 'caught_stealing_king',
  'hit_machine', 'rbi_collector', 'run_radar',
  'leadoff_maniac', 'second_artisan', 'cleanup_killer', 'lower_gambler', 'four_obsession', 'odd_even_master',
  'one_team', 'team_explorer', 'home_maniac', 'away_expert',
  'order_nomad', 'full_count',
  'hr_hunter', 'speedster',
  'prophet', 'streak_7',
  'allrounder', 'tragic_fan',
  'nohit_survivor', 'walkoff_magnet',
  'streak_14', 'attendance_50',
  'drifter', 'all_team_conqueror',
  'hr_master', 'growth_curve',
  'path_of_pain', 'rollercoaster', 'consistency',
  'xp_explosion', 'streak_30', 'veteran_100',
  'oracle', 'grand_slam',
  'collector',
];

export async function calculateTraits(
  character: ICharacter
): Promise<{ activeTrait: string | null; earnedBadges: string[]; newBadges: string[] }> {
  const userId = character.userId;

  // 전체 배치 가져오기 (정산 완료된 것만)
const allPlacements = await Placement.find({ userId, status: 'settled' }).sort({ createdAt: -1 }).lean() as unknown as IPlacement[];

  if (allPlacements.length === 0) {
    return { activeTrait: null, earnedBadges: [], newBadges: [] };
  }

  const recent10 = allPlacements.slice(0, 10);
  const prev10 = allPlacements.slice(10, 20);

  // ── 통계 사전 계산 ──

  // 최근 10회 적중률
  const settledRecent = recent10.filter(p => p.isCorrect !== undefined);
  const recent10Correct = settledRecent.filter(p => p.isCorrect).length;
  const recent10Total = settledRecent.length;

  // 최근 10회 팀 분포
  const recentTeams = new Map<string, number>();
  for (const p of recent10) {
    recentTeams.set(p.team, (recentTeams.get(p.team) || 0) + 1);
  }

  // 최근 10회 타순 분포
  const recentOrders = new Map<number, number>();
  for (const p of recent10) {
    recentOrders.set(p.battingOrder, (recentOrders.get(p.battingOrder) || 0) + 1);
  }

  // 누적 팀 / 타순
  const allTeams = new Set<string>();
  const allOrders = new Set<number>();
  for (const p of allPlacements) {
    allTeams.add(p.team);
    allOrders.add(p.battingOrder);
  }

  // 홈/원정 판별 (Game 조인)
  let recentHomeCount = 0;
  let recentAwayCount = 0;
  const gameIds = [...new Set(recent10.map(p => p.gameId))];
  const games = await Game.find({ gameId: { $in: gameIds } }).lean();
  const gameMap = new Map(games.map(g => [g.gameId, g]));
  for (const p of recent10) {
    const game = gameMap.get(p.gameId);
    if (game) {
      if (p.team === game.homeTeam) recentHomeCount++;
      else recentAwayCount++;
    }
  }

  // 누적 XP 항목별 발생 횟수
  let cumulativeHomeRuns = 0;
  let cumulativeStolenBases = 0;
  let cumulativeWalkOffs = 0;
  let cumulativeCaughtStealing = 0;
  let cumulativeNoHitPenalty = 0;
  let maxSingleXp = 0;

  for (const p of allPlacements) {
    const bd = p.xpBreakdown;
    if (bd) {
      if (bd.homeRun > 0) cumulativeHomeRuns++;
      if (bd.stolenBase > 0) cumulativeStolenBases++;
      if (bd.walkOff > 0) cumulativeWalkOffs++;
      if (bd.caughtStealing < 0) cumulativeCaughtStealing++;
      if (bd.noHitPenalty < 0) cumulativeNoHitPenalty++;
    }
    const totalXp = (p.xpFromPlayer || 0) + (p.xpFromPrediction || 0);
    if (totalXp > maxSingleXp) maxSingleXp = totalXp;
  }

  // 최근 10회 항목별 발생 횟수
  let recentHitsCount = 0;
  let recentRbiCount = 0;
  let recentRunsCount = 0;
  let recentXpSum = 0;

  for (const p of recent10) {
    const bd = p.xpBreakdown;
    if (bd) {
      if (bd.hits > 0) recentHitsCount++;
      if (bd.rbi > 0) recentRbiCount++;
      if (bd.runs > 0) recentRunsCount++;
    }
    recentXpSum += (p.xpFromPlayer || 0) + (p.xpFromPrediction || 0);
  }

  let prevXpSum = 0;
  for (const p of prev10) {
    prevXpSum += (p.xpFromPlayer || 0) + (p.xpFromPrediction || 0);
  }

  // 현재 뱃지 수 (이전 뱃지 + 이번에 새로 추가될 뱃지를 합산하기 위해 먼저 계산)
  const previousBadges = new Set(character.earnedBadges || []);

  const ctx: TraitContext = {
    recent10,
    prev10,
    allPlacements,
    character,
    recent10Correct,
    recent10Total,
    recentTeams,
    recentOrders,
    recentHomeCount,
    recentAwayCount,
    allTeams,
    allOrders,
    cumulativeHomeRuns,
    cumulativeStolenBases,
    cumulativeWalkOffs,
    cumulativeCaughtStealing,
    cumulativeNoHitPenalty,
    recentHitsCount,
    recentRbiCount,
    recentRunsCount,
    recentXpSum,
    prevXpSum,
    maxSingleXp,
    currentBadgeCount: previousBadges.size,
  };

  // ── 뱃지 판별 ──
  const earnedBadges = new Set<string>(previousBadges);
  const newBadges: string[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    try {
      if (badge.check(ctx)) {
        if (!previousBadges.has(badge.id)) {
          newBadges.push(badge.id);
        }
        earnedBadges.add(badge.id);
      }
    } catch {
      // 조건 체크 중 에러 무시
    }
  }

  // collector 재체크 (새 뱃지 추가 후)
  ctx.currentBadgeCount = earnedBadges.size;
  const collectorBadge = BADGE_DEFINITIONS.find(b => b.id === 'collector');
  if (collectorBadge && collectorBadge.check(ctx)) {
    if (!previousBadges.has('collector')) {
      newBadges.push('collector');
    }
    earnedBadges.add('collector');
  }

  // ── 대표 칭호 결정 (새 뱃지 우선, 없으면 희귀도 순) ──
  let activeTrait: string | null = null;

  if (newBadges.length > 0) {
    // 새 뱃지 중 가장 희귀한 것
    let highestRarity = -1;
    for (const id of newBadges) {
      const idx = RARITY_ORDER.indexOf(id);
      if (idx > highestRarity) {
        highestRarity = idx;
        activeTrait = id;
      }
    }
  } else {
    // 보유 뱃지 중 가장 희귀한 것
    let highestRarity = -1;
    for (const id of earnedBadges) {
      const idx = RARITY_ORDER.indexOf(id);
      if (idx > highestRarity) {
        highestRarity = idx;
        activeTrait = id;
      }
    }
  }

  return {
    activeTrait,
    earnedBadges: [...earnedBadges],
    newBadges,
  };
}

// 뱃지 ID로 정의 가져오기
export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === id);
}

// 전체 뱃지 목록 (프론트용)
export function getAllBadges(): Array<{ id: string; emoji: string; name: string; category: string; description: string }> {
  return BADGE_DEFINITIONS.map(b => ({
    id: b.id,
    emoji: b.emoji,
    name: b.name,
    category: b.category,
    description: b.description,
  }));
}
