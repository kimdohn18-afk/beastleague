import { Placement } from '../models/Placement';
import { Character } from '../models/Character';
import { League } from '../models/League';
import { Game } from '../models/Game';
import mongoose from 'mongoose';

// ━━━ 타입 정의 ━━━
export interface AchievementDefinition {
  id: string;
  emoji: string;
  name: string;
  category: string;
  description: string;
  condition: string;
  check: (ctx: AchievementContext) => boolean;
}

export interface TeamAchievementTier {
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  minCount: number;
  emoji: string;
  label: string;
}

export interface AchievementContext {
  totalPlacements: number;
  totalXp: number;
  correctPredictions: number;
  maxConsecutiveCorrect: number;
  currentStreak: number;
  maxStreak: number;
  homerunGames: number;
  extraBaseHitGames: number;
  stolenBaseGames: number;
  walkoffGames: number;
  totalHits: number;
  totalRbi: number;
  totalRuns: number;
  maxSingleXp: number;
  minSingleXp: number;
  hasNegativeXp: boolean;
  hasZeroXp: boolean;
  noHitGames: number;
  failedPredictions: number;
  maxTeamLoseStreak: number;
  teamLossHighXpCount: number; // 팀 패배인데 XP 30+
  uniqueOrders: Set<number>;
  uniqueTeams: Set<string>;
  leagueCount: number;
  earnedCount: number; // 수집 업적용 (재귀 계산)
  teamPlacementCounts: Record<string, number>;
}

// ━━━ 팀 정의 ━━━
export const KBO_TEAMS = [
  { id: 'samsung', name: '삼성 라이온즈', emoji: '🦁' },
  { id: 'kia', name: '기아 타이거즈', emoji: '🐯' },
  { id: 'lg', name: 'LG 트윈스', emoji: '🤞' },
  { id: 'doosan', name: '두산 베어스', emoji: '🐻' },
  { id: 'kt', name: 'KT 위즈', emoji: '🧙' },
  { id: 'ssg', name: 'SSG 랜더스', emoji: '🛬' },
  { id: 'lotte', name: '롯데 자이언츠', emoji: '🦅' },
  { id: 'hanwha', name: '한화 이글스', emoji: '🦅' },
  { id: 'nc', name: 'NC 다이노스', emoji: '🦕' },
  { id: 'kiwoom', name: '키움 히어로즈', emoji: '🦸' },
];

export const TEAM_TIERS: TeamAchievementTier[] = [
  { tier: 'bronze', minCount: 1, emoji: '🥉', label: '동' },
  { tier: 'silver', minCount: 5, emoji: '🥈', label: '은' },
  { tier: 'gold', minCount: 15, emoji: '🥇', label: '금' },
  { tier: 'diamond', minCount: 30, emoji: '💎', label: '다이아' },
];

// ━━━ 일반 업적 정의 (51개) ━━━
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // 입문 (7)
  { id: 'first_placement', emoji: '👣', name: '첫 발걸음', category: 'beginner', description: '모험의 시작!', condition: '첫 배치 완료', check: ctx => ctx.totalPlacements >= 1 },
  { id: 'rookie', emoji: '🌱', name: '루키', category: 'beginner', description: '이제 좀 감이 온다', condition: '누적 배치 10회', check: ctx => ctx.totalPlacements >= 10 },
  { id: 'regular', emoji: '🏠', name: '단골', category: 'beginner', description: '매일 찾아오는 단골손님', condition: '누적 배치 30회', check: ctx => ctx.totalPlacements >= 30 },
  { id: 'veteran', emoji: '⭐', name: '베테랑', category: 'beginner', description: '노련한 베테랑', condition: '누적 배치 50회', check: ctx => ctx.totalPlacements >= 50 },
  { id: 'ironman', emoji: '🦾', name: '철인', category: 'beginner', description: '쉬지 않는 철인', condition: '누적 배치 100회', check: ctx => ctx.totalPlacements >= 100 },
  { id: 'legend', emoji: '👑', name: '레전드', category: 'beginner', description: '전설이 되다', condition: '누적 배치 200회', check: ctx => ctx.totalPlacements >= 200 },
  { id: 'first_league', emoji: '🤝', name: '첫 리그 참가', category: 'beginner', description: '함께하면 더 재밌지', condition: '리그 1회 이상 가입', check: ctx => ctx.leagueCount >= 1 },

  // XP 성장 (6)
  { id: 'xp_seed', emoji: '🫘', name: '씨앗', category: 'xp', description: '작은 씨앗이 심어졌다', condition: '누적 XP 100', check: ctx => ctx.totalXp >= 100 },
  { id: 'xp_sprout', emoji: '🌿', name: '새싹', category: 'xp', description: '새싹이 돋아나다', condition: '누적 XP 500', check: ctx => ctx.totalXp >= 500 },
  { id: 'xp_sapling', emoji: '🌳', name: '묘목', category: 'xp', description: '묘목으로 자라다', condition: '누적 XP 1,000', check: ctx => ctx.totalXp >= 1000 },
  { id: 'xp_tree', emoji: '🌲', name: '나무', category: 'xp', description: '단단한 나무가 되다', condition: '누적 XP 3,000', check: ctx => ctx.totalXp >= 3000 },
  { id: 'xp_great_tree', emoji: '🏔️', name: '거목', category: 'xp', description: '거대한 거목', condition: '누적 XP 5,000', check: ctx => ctx.totalXp >= 5000 },
  { id: 'xp_world_tree', emoji: '🌍', name: '세계수', category: 'xp', description: '세계수에 도달하다', condition: '누적 XP 10,000', check: ctx => ctx.totalXp >= 10000 },

  // 예측 (6)
  { id: 'first_correct', emoji: '🎯', name: '첫 적중', category: 'prediction', description: '감이 왔다!', condition: '승리 예측 첫 성공', check: ctx => ctx.correctPredictions >= 1 },
  { id: 'getting_it', emoji: '🔮', name: '감잡았다', category: 'prediction', description: '점점 느낌이 온다', condition: '누적 적중 10회', check: ctx => ctx.correctPredictions >= 10 },
  { id: 'prophet', emoji: '🧙‍♂️', name: '예언자', category: 'prediction', description: '예언자의 눈', condition: '누적 적중 30회', check: ctx => ctx.correctPredictions >= 30 },
  { id: 'divine', emoji: '👁️', name: '신들린', category: 'prediction', description: '신이 내린 촉', condition: '누적 적중 50회', check: ctx => ctx.correctPredictions >= 50 },
  { id: 'hot_streak', emoji: '🔥', name: '촉이 좋네', category: 'prediction', description: '연속으로 맞추다니', condition: '연속 적중 3회', check: ctx => ctx.maxConsecutiveCorrect >= 3 },
  { id: 'fortune_teller', emoji: '🃏', name: '점쟁이', category: 'prediction', description: '점쟁이급 예측력', condition: '연속 적중 5회', check: ctx => ctx.maxConsecutiveCorrect >= 5 },

  // 타격 이벤트 (8)
  { id: 'first_hr', emoji: '💥', name: '첫 홈런', category: 'batting', description: '첫 홈런의 짜릿함', condition: '홈런 경기 1회', check: ctx => ctx.homerunGames >= 1 },
  { id: 'hr_mania', emoji: '🔥', name: '홈런 매니아', category: 'batting', description: '홈런에 미치다', condition: '홈런 경기 10회', check: ctx => ctx.homerunGames >= 10 },
  { id: 'hr_king', emoji: '🏆', name: '홈런왕', category: 'batting', description: '진정한 홈런왕', condition: '홈런 경기 30회', check: ctx => ctx.homerunGames >= 30 },
  { id: 'extra_base', emoji: '💪', name: '장타력', category: 'batting', description: '장타의 달인', condition: '2루타 이상 경기 누적 10회', check: ctx => ctx.extraBaseHitGames >= 10 },
  { id: 'first_steal', emoji: '💨', name: '도루 성공', category: 'batting', description: '바람처럼 빠르게', condition: '도루 경기 첫 경험', check: ctx => ctx.stolenBaseGames >= 1 },
  { id: 'speedster', emoji: '⚡', name: '스피드스터', category: 'batting', description: '도루의 신', condition: '도루 경기 10회', check: ctx => ctx.stolenBaseGames >= 10 },
  { id: 'first_walkoff', emoji: '🎬', name: '끝내기', category: 'batting', description: '극적인 끝내기!', condition: '워크오프 첫 경험', check: ctx => ctx.walkoffGames >= 1 },
  { id: 'walkoff_king', emoji: '🎭', name: '끝장왕', category: 'batting', description: '끝내기 전문가', condition: '워크오프 5회', check: ctx => ctx.walkoffGames >= 5 },

  // 누적 스탯 (3)
  { id: 'hit_machine', emoji: '🏏', name: '안타 제조기', category: 'stats', description: '안타가 쏟아진다', condition: '누적 안타 50개', check: ctx => ctx.totalHits >= 50 },
  { id: 'rbi_king', emoji: '📊', name: '타점왕', category: 'stats', description: '득점권에서 강하다', condition: '누적 타점 30', check: ctx => ctx.totalRbi >= 30 },
  { id: 'run_king', emoji: '🏃', name: '득점왕', category: 'stats', description: '홈을 밟는 달인', condition: '누적 득점 30', check: ctx => ctx.totalRuns >= 30 },

  // 스트릭 (6)
  { id: 'streak_3', emoji: '🔥', name: '3일 연속', category: 'streak', description: '3일 연속 출석!', condition: '3일 연속 배치', check: ctx => ctx.maxStreak >= 3 },
  { id: 'streak_7', emoji: '📅', name: '주간 개근', category: 'streak', description: '일주일 개근', condition: '7일 연속 배치', check: ctx => ctx.maxStreak >= 7 },
  { id: 'streak_14', emoji: '🗓️', name: '2주 개근', category: 'streak', description: '2주 연속 개근', condition: '14일 연속 배치', check: ctx => ctx.maxStreak >= 14 },
  { id: 'streak_30', emoji: '🏅', name: '한 달 개근', category: 'streak', description: '한 달 내내 함께', condition: '30일 연속 배치', check: ctx => ctx.maxStreak >= 30 },
  { id: 'streak_60', emoji: '💪', name: '불꽃 의지', category: 'streak', description: '60일 연속의 의지', condition: '60일 연속 배치', check: ctx => ctx.maxStreak >= 60 },
  { id: 'streak_100', emoji: '🐉', name: '전설의 근성', category: 'streak', description: '100일 연속 달성', condition: '100일 연속 배치', check: ctx => ctx.maxStreak >= 100 },

  // 한방 (4)
  { id: 'big_hit', emoji: '💰', name: '대박', category: 'singleGame', description: '한방에 대박!', condition: '한 경기 XP 50 이상', check: ctx => ctx.maxSingleXp >= 50 },
  { id: 'jackpot', emoji: '🎰', name: '잭팟', category: 'singleGame', description: '잭팟 터졌다!', condition: '한 경기 XP 80 이상', check: ctx => ctx.maxSingleXp >= 80 },
  { id: 'explosion', emoji: '💣', name: '폭발', category: 'singleGame', description: 'XP 폭발!', condition: '한 경기 XP 100 이상', check: ctx => ctx.maxSingleXp >= 100 },
  { id: 'goat', emoji: '🐐', name: '역대급', category: 'singleGame', description: '역대급 한 경기', condition: '한 경기 XP 150 이상', check: ctx => ctx.maxSingleXp >= 150 },

  // 탐험 (3)
  { id: 'order_explorer', emoji: '🧭', name: '타순 탐험가', category: 'explore', description: '모든 타순을 경험하다', condition: '1~9번 타순 모두 배치', check: ctx => ctx.uniqueOrders.size >= 9 },
  { id: 'all_rounder', emoji: '🗺️', name: '올라운더', category: 'explore', description: '여러 팀을 넘나드는', condition: '서로 다른 5개 팀 배치', check: ctx => ctx.uniqueTeams.size >= 5 },
  { id: 'nationwide', emoji: '🇰🇷', name: '전국구', category: 'explore', description: '전국 10개 구단 정복', condition: '모든 10개 구단 배치', check: ctx => ctx.uniqueTeams.size >= 10 },

  // 수집 (2)
  { id: 'collector_15', emoji: '📦', name: '수집가', category: 'collection', description: '업적 수집가', condition: '업적 15개 이상 달성', check: ctx => ctx.earnedCount >= 15 },
  { id: 'collector_30', emoji: '🏛️', name: '컬렉터', category: 'collection', description: '진정한 컬렉터', condition: '업적 30개 이상 달성', check: ctx => ctx.earnedCount >= 30 },

  // 역경 (6)
  { id: 'loss_hero', emoji: '😤', name: '역경의 승리자', category: 'adversity', description: '져도 빛나는 사나이', condition: '팀 패배인데 XP 30 이상', check: ctx => ctx.teamLossHighXpCount >= 1 },
  { id: 'nohit_survivor', emoji: '😅', name: '노히트 생존자', category: 'adversity', description: '무안타에도 굴하지 않는', condition: '배치 선수 무안타 5회 경험', check: ctx => ctx.noHitGames >= 5 },
  { id: 'wrong_a_lot', emoji: '🙈', name: '예측 실패왕', category: 'adversity', description: '틀려도 괜찮아', condition: '예측 틀린 횟수 20회', check: ctx => ctx.failedPredictions >= 20 },
  { id: 'lose_streak', emoji: '😭', name: '연패 체험', category: 'adversity', description: '함께 아파하는 팬', condition: '배치 팀 3연패 경험', check: ctx => ctx.maxTeamLoseStreak >= 3 },
  { id: 'zero_xp', emoji: '💀', name: 'XP 0', category: 'adversity', description: '바닥을 경험하다', condition: '한 경기 XP 0 획득', check: ctx => ctx.hasZeroXp },
  { id: 'negative_xp', emoji: '🕳️', name: '바닥에서', category: 'adversity', description: '마이너스도 경험이다', condition: '한 경기 XP 마이너스 경험', check: ctx => ctx.hasNegativeXp },
];

// ━━━ 카테고리 라벨 ━━━
export const CATEGORY_LABELS: Record<string, { emoji: string; name: string }> = {
  beginner: { emoji: '👣', name: '입문' },
  xp: { emoji: '🌱', name: 'XP 성장' },
  prediction: { emoji: '🎯', name: '예측' },
  batting: { emoji: '⚾', name: '타격 이벤트' },
  stats: { emoji: '📊', name: '누적 스탯' },
  streak: { emoji: '🔥', name: '스트릭' },
  singleGame: { emoji: '💥', name: '한방' },
  explore: { emoji: '🧭', name: '탐험' },
  collection: { emoji: '📦', name: '수집' },
  adversity: { emoji: '😤', name: '역경' },
  team: { emoji: '❤️', name: '팀 충성도' },
};

// ━━━ 컨텍스트 빌드 ━━━
async function buildContext(userId: string, characterXp: number): Promise<AchievementContext> {
  const placements = await Placement.find({ userId, status: 'settled', date: { $not: /^tutorial-/ } })
    .sort({ date: -1 })
    .lean();

  const games = await Game.find({
    gameId: { $in: placements.map(p => p.gameId) },
  }).lean();
  const gameMap: Record<string, any> = {};
  for (const g of games) gameMap[g.gameId] = g;

  let correctPredictions = 0;
  let failedPredictions = 0;
  let maxConsecutiveCorrect = 0;
  let currentConsecutiveCorrect = 0;
  let homerunGames = 0;
  let extraBaseHitGames = 0;
  let stolenBaseGames = 0;
  let walkoffGames = 0;
  let totalHits = 0;
  let totalRbi = 0;
  let totalRuns = 0;
  let maxSingleXp = 0;
  let minSingleXp = Infinity;
  let hasNegativeXp = false;
  let hasZeroXp = false;
  let noHitGames = 0;
  let teamLossHighXpCount = 0;
  const uniqueOrders = new Set<number>();
  const uniqueTeams = new Set<string>();
  const teamPlacementCounts: Record<string, number> = {};

  // 스트릭 계산
  let maxStreak = 0;
  let currentStreak = 0;
  const dates = [...new Set(placements.map(p => p.date))].sort();
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      currentStreak = diff === 1 ? currentStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
  }

  // 연패 계산
  let maxTeamLoseStreak = 0;
  let currentTeamLoseStreak = 0;

  // 날짜순 정렬
  const placementsByDate = [...placements].sort((a, b) => a.date.localeCompare(b.date));

  for (const p of placementsByDate) {
    const game = gameMap[p.gameId];
    if (!game) continue;

    // 타순 (string → number)
    if (p.battingOrder) uniqueOrders.add(Number(p.battingOrder));

    // 팀
    if (p.team) {
      // team이 'home'/'away'면 실제 팀명으로 변환
      const teamName = p.team === 'home' ? game.homeTeam
                      : p.team === 'away' ? game.awayTeam
                      : p.team;
      uniqueTeams.add(teamName);
      teamPlacementCounts[teamName] = (teamPlacementCounts[teamName] || 0) + 1;
    }

    // 점수 (homeScore / awayScore)
    const homeScore = game.homeScore ?? 0;
    const awayScore = game.awayScore ?? 0;

    // 예측 적중
    let actualWinner = '';
    if (homeScore > awayScore) actualWinner = game.homeTeam;
    else if (awayScore > homeScore) actualWinner = game.awayTeam;

    if (p.predictedWinner && actualWinner) {
      if (p.predictedWinner === actualWinner) {
        correctPredictions++;
        currentConsecutiveCorrect++;
        maxConsecutiveCorrect = Math.max(maxConsecutiveCorrect, currentConsecutiveCorrect);
      } else {
        failedPredictions++;
        currentConsecutiveCorrect = 0;
      }
    } else if (p.predictedWinner && !actualWinner) {
      // 무승부 → 적중 아님
      currentConsecutiveCorrect = 0;
    }

    // XP (xpFromPlayer + xpFromPrediction)
    const xp = (p.xpFromPlayer ?? 0) + (p.xpFromPrediction ?? 0);
    maxSingleXp = Math.max(maxSingleXp, xp);
    minSingleXp = Math.min(minSingleXp, xp);
    if (xp === 0) hasZeroXp = true;
    if (xp < 0) hasNegativeXp = true;

    // 팀 승패
    const isHome = p.team === 'home';
    const myTeamScore = isHome ? homeScore : awayScore;
    const oppTeamScore = isHome ? awayScore : homeScore;
    const teamLost = myTeamScore < oppTeamScore;

    if (teamLost) {
      currentTeamLoseStreak++;
      maxTeamLoseStreak = Math.max(maxTeamLoseStreak, currentTeamLoseStreak);
      if (xp >= 30) teamLossHighXpCount++;
    } else {
      currentTeamLoseStreak = 0;
    }

    // 타자 기록 (batterRecords, 필드가 전부 string)
    const batters = isHome
      ? (game.batterRecords?.home || [])
      : (game.batterRecords?.away || []);

    const myBatter = batters.find((b: any) => Number(b.order) === Number(p.battingOrder));
    const playerName = myBatter?.name || '';

    if (myBatter) {
      const hits = parseInt(myBatter.hits, 10) || 0;
      const rbi = parseInt(myBatter.rbi, 10) || 0;
      const runs = parseInt(myBatter.runs, 10) || 0;
      const atBats = parseInt(myBatter.atBats, 10) || 0;

      totalHits += hits;
      totalRbi += rbi;
      totalRuns += runs;

      if (atBats >= 2 && hits === 0) noHitGames++;
    }

    // 이벤트 (events: { type, detail })
    const events = game.events || [];
    let hasHR = false;
    let hasExtraBase = false;
    let hasSB = false;
    let hasWalkoff = false;

    for (const ev of events) {
      // detail에 선수 이름이 포함되어 있는지 확인
      const matchesPlayer = playerName && ev.detail && ev.detail.includes(playerName);
      if (!matchesPlayer) continue;

      const t = (ev.type || '').toLowerCase();
      if (t === 'homerun' || t === 'home_run') hasHR = true;
      if (t === 'double' || t === 'triple' || t === 'homerun' || t === 'home_run') hasExtraBase = true;
      if (t === 'stolen_base' || t === 'stolenbase') hasSB = true;
      if (t === 'walkoff' || t === 'walk_off') hasWalkoff = true;
    }

    if (hasHR) homerunGames++;
    if (hasExtraBase) extraBaseHitGames++;
    if (hasSB) stolenBaseGames++;
    if (hasWalkoff) walkoffGames++;
  }

  // 리그 참가 수
  const leagueCount = await League.countDocuments({ members: new mongoose.Types.ObjectId(userId) });

  return {
    totalPlacements: placements.length,
    totalXp: characterXp,
    correctPredictions,
    maxConsecutiveCorrect,
    currentStreak,
    maxStreak,
    homerunGames,
    extraBaseHitGames,
    stolenBaseGames,
    walkoffGames,
    totalHits,
    totalRbi,
    totalRuns,
    maxSingleXp,
    minSingleXp: minSingleXp === Infinity ? 0 : minSingleXp,
    hasNegativeXp,
    hasZeroXp,
    noHitGames,
    failedPredictions,
    maxTeamLoseStreak,
    teamLossHighXpCount,
    uniqueOrders,
    uniqueTeams,
    leagueCount,
    earnedCount: 0,
    teamPlacementCounts,
  };
}

// ━━━ 팀 등급 계산 ━━━
function getTeamTier(count: number): TeamAchievementTier | null {
  let best: TeamAchievementTier | null = null;
  for (const tier of TEAM_TIERS) {
    if (count >= tier.minCount) best = tier;
  }
  return best;
}

// ━━━ 업적 계산 메인 함수 ━━━
export async function calculateAchievements(userId: string, characterId: string) {
  const character = await Character.findById(characterId).lean();
  if (!character) throw new Error('Character not found');

  const ctx = await buildContext(userId, character.xp || 0);

  // 1차: 수집 업적 제외하고 계산
  const earned: string[] = [];
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (def.category === 'collection') continue;
    if (def.check(ctx)) earned.push(def.id);
  }

  // 팀 업적
  const teamAchievements: Array<{
    teamId: string;
    teamName: string;
    teamEmoji: string;
    tier: TeamAchievementTier;
    count: number;
  }> = [];

  for (const team of KBO_TEAMS) {
    const count = ctx.teamPlacementCounts[team.id] || 0;
    // team 이름으로도 매칭 시도
    const countByName = ctx.teamPlacementCounts[team.name] || 0;
    const totalCount = count + countByName;
    const tier = getTeamTier(totalCount);
    if (tier) {
      teamAchievements.push({
        teamId: team.id,
        teamName: team.name,
        teamEmoji: team.emoji,
        tier,
        count: totalCount,
      });
    }
  }

  // 팀 업적도 earned 카운트에 포함
  ctx.earnedCount = earned.length + teamAchievements.length;

  // 2차: 수집 업적 체크
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (def.category !== 'collection') continue;
    if (def.check(ctx)) earned.push(def.id);
  }

  // 최종 카운트
  const finalEarnedCount = earned.length + teamAchievements.length;

  // activeTrait: 가장 최근 달성한 희귀 업적
  const RARITY_ORDER = [
    'legend', 'streak_100', 'goat', 'xp_world_tree', 'nationwide',
    'streak_60', 'explosion', 'divine', 'xp_great_tree', 'collector_30',
    'ironman', 'hr_king', 'streak_30', 'prophet', 'xp_tree',
    'veteran', 'walkoff_king', 'fortune_teller', 'speedster',
    'collector_15', 'streak_14', 'jackpot', 'xp_sapling',
    'regular', 'hr_mania', 'getting_it', 'hit_machine', 'rbi_king', 'run_king',
    'streak_7', 'big_hit', 'extra_base', 'all_rounder', 'order_explorer',
    'hot_streak', 'loss_hero', 'nohit_survivor', 'wrong_a_lot', 'lose_streak',
    'rookie', 'xp_sprout', 'first_hr', 'first_steal', 'first_walkoff',
    'first_correct', 'xp_seed', 'first_placement', 'first_league',
    'zero_xp', 'negative_xp',
  ];

  let activeTrait = null;
  for (const id of RARITY_ORDER) {
    if (earned.includes(id)) {
      const def = ACHIEVEMENT_DEFINITIONS.find(d => d.id === id)!;
      activeTrait = { id: def.id, emoji: def.emoji, name: def.name, description: def.description };
      break;
    }
  }

  // 캐릭터 업데이트
  await Character.findByIdAndUpdate(characterId, {
    activeTrait: activeTrait ? `${activeTrait.emoji} ${activeTrait.name}` : null,
    earnedAchievements: earned,
    teamAchievements: teamAchievements.map(t => ({
      teamId: t.teamId,
      tier: t.tier.tier,
      count: t.count,
    })),
  });

  return { activeTrait, earned, teamAchievements, earnedCount: finalEarnedCount };
}

// ━━━ 프론트엔드용 헬퍼 ━━━
export function getAllAchievements() {
  return ACHIEVEMENT_DEFINITIONS.map(d => ({
    id: d.id,
    emoji: d.emoji,
    name: d.name,
    category: d.category,
    description: d.description,
    condition: d.condition,
  }));
}

export function getAchievementById(id: string) {
  return ACHIEVEMENT_DEFINITIONS.find(d => d.id === id);
}
