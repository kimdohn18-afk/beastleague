import { Character } from '../models/Character';
import { Placement } from '../models/Placement';
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

export interface AchievementContext {
  totalPlacements: number;
  settledPlacements: number;
  correctPredictions: number;
  maxConsecutiveCorrect: number;
  allKillCount: number;
  failedPredictions: number;
  maxSinglePlacementXp: number;
  hasNegativeXp: boolean;
  totalXp: number;
  currentXp: number;
  currentStreak: number;
  maxStreak: number;
  earnedCount: number;
  totalHits: number;
  totalDoubles: number;
  totalTriples: number;
  totalHomeRuns: number;
  totalRbi: number;
  totalRuns: number;
  totalStolenBases: number;
  totalWalkOffs: number;
  maxSingleHomeRuns: number;
  maxSingleHits: number;
  maxSingleRbi: number;
  maxSingleStolenBases: number;
  uniqueTeamsPlaced: number;
  uniqueBattingOrders: number;
  lossStreakMax: number;
  negativeXpCount: number;
  zeroHitSettledCount: number;
}

// ━━━ 업적 정의 (53개) ━━━
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ══════ 입문 beginner (3) ══════
  { id: 'first_placement', emoji: '⚾', name: '첫 배치', category: 'beginner', description: '첫 배치를 했다!', condition: '배치 1회', check: c => c.totalPlacements >= 1 },
  { id: 'placement_10', emoji: '📋', name: '10번 배치', category: 'beginner', description: '10번 배치 완료', condition: '배치 10회', check: c => c.totalPlacements >= 10 },
  { id: 'placement_50', emoji: '🏟️', name: '단골 감독', category: 'beginner', description: '50번 배치 완료', condition: '배치 50회', check: c => c.totalPlacements >= 50 },

  // ══════ 예측 prediction (10) ══════
  { id: 'correct_1', emoji: '🎯', name: '첫 적중', category: 'prediction', description: '감이 왔다!', condition: '승리 예측 첫 성공', check: c => c.correctPredictions >= 1 },
  { id: 'correct_10', emoji: '🔮', name: '감잡았다', category: 'prediction', description: '점점 느낌이 온다', condition: '누적 적중 10회', check: c => c.correctPredictions >= 10 },
  { id: 'correct_30', emoji: '🧙', name: '예언자', category: 'prediction', description: '예언자의 눈', condition: '누적 적중 30회', check: c => c.correctPredictions >= 30 },
  { id: 'correct_50', emoji: '👁️', name: '신들린 예측', category: 'prediction', description: '신이 내린 촉', condition: '누적 적중 50회', check: c => c.correctPredictions >= 50 },
  { id: 'correct_100', emoji: '🌟', name: '예측의 신', category: 'prediction', description: '100번 맞추다', condition: '누적 적중 100회', check: c => c.correctPredictions >= 100 },
  { id: 'streak_correct_3', emoji: '🔥', name: '촉이 좋네', category: 'prediction', description: '3연속 적중', condition: '연속 적중 3회', check: c => c.maxConsecutiveCorrect >= 3 },
  { id: 'streak_correct_5', emoji: '🃏', name: '점쟁이', category: 'prediction', description: '5연속 적중', condition: '연속 적중 5회', check: c => c.maxConsecutiveCorrect >= 5 },
  { id: 'streak_correct_10', emoji: '💫', name: '무적의 예측', category: 'prediction', description: '10연속 적중', condition: '연속 적중 10회', check: c => c.maxConsecutiveCorrect >= 10 },
  { id: 'all_kill_1', emoji: '💥', name: '올킬', category: 'prediction', description: '하루 전 경기 적중', condition: '올킬 1회', check: c => c.allKillCount >= 1 },
  { id: 'all_kill_5', emoji: '☄️', name: '올킬 마스터', category: 'prediction', description: '올킬 5회 달성', condition: '올킬 5회', check: c => c.allKillCount >= 5 },

  // ══════ XP 성장 xp (7) ══════
  { id: 'xp_100', emoji: '🫘', name: '씨앗', category: 'xp', description: '작은 씨앗이 심어졌다', condition: '누적 XP 100', check: c => c.totalXp >= 100 },
  { id: 'xp_500', emoji: '🌿', name: '새싹', category: 'xp', description: '새싹이 돋아나다', condition: '누적 XP 500', check: c => c.totalXp >= 500 },
  { id: 'xp_1000', emoji: '🌳', name: '묘목', category: 'xp', description: '묘목으로 자라다', condition: '누적 XP 1,000', check: c => c.totalXp >= 1000 },
  { id: 'xp_3000', emoji: '🌲', name: '나무', category: 'xp', description: '단단한 나무가 되다', condition: '누적 XP 3,000', check: c => c.totalXp >= 3000 },
  { id: 'xp_5000', emoji: '🏔️', name: '거목', category: 'xp', description: '거대한 거목', condition: '누적 XP 5,000', check: c => c.totalXp >= 5000 },
  { id: 'xp_10000', emoji: '🌍', name: '세계수', category: 'xp', description: '세계수에 도달하다', condition: '누적 XP 10,000', check: c => c.totalXp >= 10000 },
  { id: 'xp_50000', emoji: '🪐', name: '우주', category: 'xp', description: '우주로 뻗어나가다', condition: '누적 XP 50,000', check: c => c.totalXp >= 50000 },

  // ══════ 타격 이벤트 batting (8) ══════
  { id: 'hit_10', emoji: '⚾', name: '안타 제조기', category: 'batting', description: '누적 안타 XP 10회분', condition: '안타 XP 10회 누적', check: c => c.totalHits >= 10 },
  { id: 'hit_50', emoji: '🏏', name: '타격왕', category: 'batting', description: '50번의 안타', condition: '안타 XP 50회 누적', check: c => c.totalHits >= 50 },
  { id: 'hr_1', emoji: '💣', name: '첫 홈런', category: 'batting', description: '첫 홈런이 터졌다!', condition: '홈런 1회', check: c => c.totalHomeRuns >= 1 },
  { id: 'hr_10', emoji: '🚀', name: '홈런포', category: 'batting', description: '홈런 10개 달성', condition: '홈런 10회', check: c => c.totalHomeRuns >= 10 },
  { id: 'hr_30', emoji: '☄️', name: '홈런왕', category: 'batting', description: '30홈런 달성', condition: '홈런 30회', check: c => c.totalHomeRuns >= 30 },
  { id: 'rbi_20', emoji: '🎯', name: '타점 장인', category: 'batting', description: '누적 타점 XP 20회분', condition: '타점 XP 20회 누적', check: c => c.totalRbi >= 20 },
  { id: 'sb_10', emoji: '💨', name: '도루 장인', category: 'batting', description: '10번의 도루', condition: '도루 10회', check: c => c.totalStolenBases >= 10 },
  { id: 'walkoff_1', emoji: '🎬', name: '끝내기 히어로', category: 'batting', description: '끝내기 안타 경험!', condition: '끝내기 1회', check: c => c.totalWalkOffs >= 1 },

  // ══════ 누적 스탯 stats (5) ══════
  { id: 'settled_10', emoji: '📊', name: '10경기 정산', category: 'stats', description: '10경기 정산 완료', condition: '정산 10회', check: c => c.settledPlacements >= 10 },
  { id: 'settled_30', emoji: '📈', name: '30경기 정산', category: 'stats', description: '30경기 정산', condition: '정산 30회', check: c => c.settledPlacements >= 30 },
  { id: 'settled_100', emoji: '🏅', name: '100경기 정산', category: 'stats', description: '100경기 돌파', condition: '정산 100회', check: c => c.settledPlacements >= 100 },
  { id: 'total_runs_30', emoji: '🏃', name: '득점 머신', category: 'stats', description: '누적 득점 30', condition: '득점 XP 30회 누적', check: c => c.totalRuns >= 30 },
  { id: 'total_hits_100', emoji: '🏆', name: '안타 마스터', category: 'stats', description: '누적 안타 100', condition: '안타 XP 100회 누적', check: c => c.totalHits >= 100 },

  // ══════ 스트릭 streak (5) ══════
  { id: 'streak_3', emoji: '🔥', name: '3일 연속', category: 'streak', description: '3일 연속 배치!', condition: '3일 연속 배치', check: c => c.maxStreak >= 3 },
  { id: 'streak_7', emoji: '📅', name: '주간 개근', category: 'streak', description: '일주일 개근', condition: '7일 연속 배치', check: c => c.maxStreak >= 7 },
  { id: 'streak_14', emoji: '🗓️', name: '2주 개근', category: 'streak', description: '2주 연속 개근', condition: '14일 연속 배치', check: c => c.maxStreak >= 14 },
  { id: 'streak_30', emoji: '🏅', name: '한 달 개근', category: 'streak', description: '한 달 내내 함께', condition: '30일 연속 배치', check: c => c.maxStreak >= 30 },
  { id: 'streak_100', emoji: '🐉', name: '전설의 근성', category: 'streak', description: '100일 연속 달성', condition: '100일 연속 배치', check: c => c.maxStreak >= 100 },

  // ══════ 한방 singleGame (4) ══════
  { id: 'single_hr_2', emoji: '💥', name: '멀티 홈런', category: 'singleGame', description: '한 경기 홈런 2개!', condition: '단일 경기 홈런 2+', check: c => c.maxSingleHomeRuns >= 2 },
  { id: 'single_hit_4', emoji: '🔥', name: '4안타 폭발', category: 'singleGame', description: '한 경기 4안타!', condition: '단일 경기 안타 4+', check: c => c.maxSingleHits >= 4 },
  { id: 'single_rbi_4', emoji: '💪', name: '타점 폭발', category: 'singleGame', description: '한 경기 4타점!', condition: '단일 경기 타점 4+', check: c => c.maxSingleRbi >= 4 },
  { id: 'single_xp_80', emoji: '⚡', name: 'XP 폭발', category: 'singleGame', description: '한 경기 80 XP!', condition: '단일 경기 XP 80+', check: c => c.maxSinglePlacementXp >= 80 },

  // ══════ 탐험 explore (4) ══════
  { id: 'explore_team_3', emoji: '🧭', name: '3팀 탐험', category: 'explore', description: '3개 팀에 배치해봤다', condition: '3팀 이상 배치', check: c => c.uniqueTeamsPlaced >= 3 },
  { id: 'explore_team_5', emoji: '🗺️', name: '5팀 탐험', category: 'explore', description: '5개 팀 경험', condition: '5팀 이상 배치', check: c => c.uniqueTeamsPlaced >= 5 },
  { id: 'explore_team_10', emoji: '🌏', name: '전팀 탐험', category: 'explore', description: '10개 팀 모두 경험!', condition: '10팀 배치', check: c => c.uniqueTeamsPlaced >= 10 },
  { id: 'explore_order_9', emoji: '📝', name: '전타순 경험', category: 'explore', description: '1~9번 타순 모두 경험', condition: '9개 타순 배치', check: c => c.uniqueBattingOrders >= 9 },

  // ══════ 역경 adversity (4) ══════
  { id: 'loss_3', emoji: '😤', name: '3연패 극복', category: 'adversity', description: '3연속 예측 실패 경험', condition: '연속 실패 3회', check: c => c.lossStreakMax >= 3 },
  { id: 'loss_5', emoji: '😡', name: '5연패 극복', category: 'adversity', description: '5연속 실패를 이겨냈다', condition: '연속 실패 5회', check: c => c.lossStreakMax >= 5 },
  { id: 'negative_xp', emoji: '📉', name: '마이너스 경험', category: 'adversity', description: '마이너스 XP를 겪다', condition: '음수 XP 경기 1회', check: c => c.negativeXpCount >= 1 },
  { id: 'zero_hit_5', emoji: '😢', name: '무안타 생존자', category: 'adversity', description: '무안타 5회 경험', condition: '무안타 경기 5회', check: c => c.zeroHitSettledCount >= 5 },

  // ══════ 수집 collection (3) ══════
  { id: 'collector_10', emoji: '📚', name: '업적 입문', category: 'collection', description: '업적 10개 달성', condition: '업적 10개', check: c => c.earnedCount >= 10 },
  { id: 'collector_15', emoji: '🏆', name: '업적 수집가', category: 'collection', description: '업적 15개 달성', condition: '업적 15개', check: c => c.earnedCount >= 15 },
  { id: 'collector_25', emoji: '👑', name: '업적 마스터', category: 'collection', description: '업적 25개 달성', condition: '업적 25개', check: c => c.earnedCount >= 25 },
];

// ━━━ 카테고리 라벨 (10개) ━━━
export const CATEGORY_LABELS: Record<string, { emoji: string; name: string }> = {
  beginner:   { emoji: '👣', name: '입문' },
  xp:         { emoji: '🌱', name: 'XP 성장' },
  prediction: { emoji: '🎯', name: '예측' },
  batting:    { emoji: '⚾', name: '타격 이벤트' },
  stats:      { emoji: '📊', name: '누적 스탯' },
  streak:     { emoji: '🔥', name: '스트릭' },
  singleGame: { emoji: '💥', name: '한방' },
  explore:    { emoji: '🧭', name: '탐험' },
  collection: { emoji: '📦', name: '수집' },
  adversity:  { emoji: '😤', name: '역경' },
};

// ━━━ 컨텍스트 빌드 ━━━
async function buildContext(userId: string, character: any): Promise<AchievementContext> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const placements = await Placement.find({
    userId: userObjId,
    date: { $not: /^tutorial-/ },
  }).sort({ date: 1 }).lean();

  const settledPlacements = placements.filter(p => p.status === 'settled');

  let correctPredictions = 0;
  let failedPredictions = 0;
  let maxConsecutiveCorrect = 0;
  let currentConsecutive = 0;
  let maxSinglePlacementXp = 0;
  let hasNegativeXp = false;

  let totalHits = 0;
  let totalDoubles = 0;
  let totalTriples = 0;
  let totalHomeRuns = 0;
  let totalRbi = 0;
  let totalRuns = 0;
  let totalStolenBases = 0;
  let totalWalkOffs = 0;

  let maxSingleHomeRuns = 0;
  let maxSingleHits = 0;
  let maxSingleRbi = 0;
  let maxSingleStolenBases = 0;

  let lossStreakMax = 0;
  let lossStreakCurrent = 0;
  let negativeXpCount = 0;
  let zeroHitSettledCount = 0;

  for (const p of settledPlacements) {
    const netXp = (p.xpFromPlayer || 0) + (p.xpFromPrediction || 0);
    maxSinglePlacementXp = Math.max(maxSinglePlacementXp, netXp);
    if (netXp < 0) {
      hasNegativeXp = true;
      negativeXpCount++;
    }

    if (p.isCorrect) {
      correctPredictions++;
      currentConsecutive++;
      maxConsecutiveCorrect = Math.max(maxConsecutiveCorrect, currentConsecutive);
      lossStreakCurrent = 0;
    } else {
      failedPredictions++;
      currentConsecutive = 0;
      lossStreakCurrent++;
      lossStreakMax = Math.max(lossStreakMax, lossStreakCurrent);
    }

    const b = p.xpBreakdown;
    if (b) {
      const hits = b.hits || 0;
      const doubles = b.double || 0;
      const triples = b.triple || 0;
      const homeRuns = b.homeRun || 0;
      const rbi = b.rbi || 0;
      const runs = b.runs || 0;
      const stolenBases = b.stolenBase || 0;
      const walkOff = b.walkOff || 0;

      totalHits += hits;
      totalDoubles += doubles;
      totalTriples += triples;
      totalHomeRuns += homeRuns;
      totalRbi += rbi;
      totalRuns += runs;
      totalStolenBases += stolenBases;
      totalWalkOffs += walkOff > 0 ? 1 : 0;

      maxSingleHomeRuns = Math.max(maxSingleHomeRuns, homeRuns);
      maxSingleHits = Math.max(maxSingleHits, hits);
      maxSingleRbi = Math.max(maxSingleRbi, rbi);
      maxSingleStolenBases = Math.max(maxSingleStolenBases, stolenBases);

      if (hits === 0) zeroHitSettledCount++;
    } else {
      zeroHitSettledCount++;
    }
  }

  // 올킬 계산
  let allKillCount = 0;
  const dateMap = new Map<string, { total: number; correct: number }>();
  for (const p of settledPlacements) {
    const d = dateMap.get(p.date) || { total: 0, correct: 0 };
    d.total++;
    if (p.isCorrect) d.correct++;
    dateMap.set(p.date, d);
  }
  for (const [, d] of dateMap) {
    if (d.total >= 1 && d.total === d.correct) allKillCount++;
  }

  // 스트릭 계산
  const placementDates = [...new Set(placements.map(p => p.date))].sort();
  let maxStreak = 0;
  let streakNow = 0;
  for (let i = 0; i < placementDates.length; i++) {
    if (i === 0) {
      streakNow = 1;
    } else {
      const prev = new Date(placementDates[i - 1]);
      const curr = new Date(placementDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      streakNow = diff === 1 ? streakNow + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, streakNow);
  }

  // 탐험
  const uniqueTeams = new Set(placements.map(p => p.team).filter(Boolean));
  const uniqueOrders = new Set(placements.map(p => p.battingOrder).filter(Boolean));

  return {
    totalPlacements: placements.length,
    settledPlacements: settledPlacements.length,
    correctPredictions,
    maxConsecutiveCorrect,
    allKillCount,
    failedPredictions,
    maxSinglePlacementXp,
    hasNegativeXp,
    totalXp: character.totalXp || character.xp || 0,
    currentXp: character.xp || 0,
    currentStreak: character.streak || 0,
    maxStreak,
    earnedCount: 0,
    totalHits,
    totalDoubles,
    totalTriples,
    totalHomeRuns,
    totalRbi,
    totalRuns,
    totalStolenBases,
    totalWalkOffs,
    maxSingleHomeRuns,
    maxSingleHits,
    maxSingleRbi,
    maxSingleStolenBases,
    uniqueTeamsPlaced: uniqueTeams.size,
    uniqueBattingOrders: uniqueOrders.size,
    lossStreakMax,
    negativeXpCount,
    zeroHitSettledCount,
  };
}

// ━━━ 희귀도 순서 ━━━
const RARITY_ORDER = [
  'streak_100', 'xp_50000', 'correct_100', 'collector_25', 'hr_30', 'explore_team_10',
  'all_kill_5', 'correct_50', 'xp_10000', 'streak_correct_10', 'streak_30', 'settled_100', 'total_hits_100',
  'correct_30', 'xp_5000', 'streak_14', 'collector_15', 'hr_10', 'loss_5', 'single_xp_80',
  'streak_correct_5', 'all_kill_1', 'xp_3000', 'streak_7', 'explore_team_5', 'hit_50',
  'correct_10', 'collector_10', 'placement_50', 'settled_30', 'rbi_20', 'sb_10',
  'single_hr_2', 'single_hit_4', 'single_rbi_4', 'total_runs_30', 'explore_order_9',
  'streak_correct_3', 'xp_1000', 'xp_500', 'xp_100', 'settled_10', 'hit_10',
  'placement_10', 'correct_1', 'first_placement', 'streak_3', 'hr_1', 'walkoff_1',
  'explore_team_3', 'loss_3', 'negative_xp', 'zero_hit_5',
];

// ━━━ 업적 계산 메인 함수 ━━━
export async function calculateAchievements(
  userId: string,
  characterId: string,
  options?: { skipTraitUpdate?: boolean }
) {
  const character = await Character.findById(characterId).lean();
  if (!character) throw new Error('Character not found');

  const ctx = await buildContext(userId, character);

  // 1차: 수집 제외
  const earned: string[] = [];
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (def.category === 'collection') continue;
    if (def.check(ctx)) earned.push(def.id);
  }

  ctx.earnedCount = earned.length;

  // 2차: 수집 업적
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (def.category !== 'collection') continue;
    if (def.check(ctx)) earned.push(def.id);
  }

  const finalEarnedCount = earned.length;

  // activeTrait 결정
  const currentTrait = (character as any).activeTrait;
  let resolvedTrait: { id: string; emoji: string; name: string; description: string } | null = null;

  if (currentTrait) {
    const def = ACHIEVEMENT_DEFINITIONS.find(d => d.id === currentTrait);
    if (def && earned.includes(currentTrait)) {
      resolvedTrait = { id: def.id, emoji: def.emoji, name: def.name, description: def.description };
    }
  }

  if (!resolvedTrait && !options?.skipTraitUpdate) {
    for (const id of RARITY_ORDER) {
      if (earned.includes(id)) {
        const def = ACHIEVEMENT_DEFINITIONS.find(d => d.id === id)!;
        resolvedTrait = { id: def.id, emoji: def.emoji, name: def.name, description: def.description };
        break;
      }
    }
  }

  // DB 업데이트
  const updatePayload: any = { earnedAchievements: earned };
  if (!options?.skipTraitUpdate) {
    updatePayload.activeTrait = resolvedTrait ? resolvedTrait.id : null;
  }
  await Character.findByIdAndUpdate(characterId, updatePayload);

  return { activeTrait: resolvedTrait, earned, earnedCount: finalEarnedCount };
}

// ━━━ 헬퍼 ━━━
export function getAllAchievements() {
  return ACHIEVEMENT_DEFINITIONS.map(d => ({
    id: d.id, emoji: d.emoji, name: d.name, category: d.category,
    description: d.description, condition: d.condition,
  }));
}

export function getAchievementById(id: string) {
  return ACHIEVEMENT_DEFINITIONS.find(d => d.id === id);
}
