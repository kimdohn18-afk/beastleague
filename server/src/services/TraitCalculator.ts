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
  // 배치
  totalPlacements: number;
  settledPlacements: number;
  correctPredictions: number;
  maxConsecutiveCorrect: number;
  allKillCount: number;
  failedPredictions: number;
  maxSinglePlacementXp: number;
  hasNegativeXp: boolean;

  // XP
  totalXp: number;
  currentXp: number;

  // 스트릭
  currentStreak: number;
  maxStreak: number;

  // 수집
  earnedCount: number;
}

// ━━━ 업적 정의 (30개) ━━━
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ── 입문 (3) ──
  { id: 'first_placement', emoji: '⚾', name: '첫 배치', category: 'beginner', description: '첫 배치를 했다!', condition: '배치 1회', check: ctx => ctx.totalPlacements >= 1 },
  { id: 'placement_10', emoji: '📋', name: '10번 배치', category: 'beginner', description: '10번 배치 완료', condition: '배치 10회', check: ctx => ctx.totalPlacements >= 10 },
  { id: 'placement_50', emoji: '🏟️', name: '단골 감독', category: 'beginner', description: '50번 배치 완료', condition: '배치 50회', check: ctx => ctx.totalPlacements >= 50 },

  // ── 예측 적중 (10) ──
  { id: 'correct_1', emoji: '🎯', name: '첫 적중', category: 'prediction', description: '감이 왔다!', condition: '승리 예측 첫 성공', check: ctx => ctx.correctPredictions >= 1 },
  { id: 'correct_10', emoji: '🔮', name: '감잡았다', category: 'prediction', description: '점점 느낌이 온다', condition: '누적 적중 10회', check: ctx => ctx.correctPredictions >= 10 },
  { id: 'correct_30', emoji: '🧙', name: '예언자', category: 'prediction', description: '예언자의 눈', condition: '누적 적중 30회', check: ctx => ctx.correctPredictions >= 30 },
  { id: 'correct_50', emoji: '👁️', name: '신들린 예측', category: 'prediction', description: '신이 내린 촉', condition: '누적 적중 50회', check: ctx => ctx.correctPredictions >= 50 },
  { id: 'correct_100', emoji: '🌟', name: '예측의 신', category: 'prediction', description: '100번 맞추다', condition: '누적 적중 100회', check: ctx => ctx.correctPredictions >= 100 },
  { id: 'streak_correct_3', emoji: '🔥', name: '촉이 좋네', category: 'prediction', description: '3연속 적중', condition: '연속 적중 3회', check: ctx => ctx.maxConsecutiveCorrect >= 3 },
  { id: 'streak_correct_5', emoji: '🃏', name: '점쟁이', category: 'prediction', description: '5연속 적중', condition: '연속 적중 5회', check: ctx => ctx.maxConsecutiveCorrect >= 5 },
  { id: 'streak_correct_10', emoji: '💫', name: '무적의 예측', category: 'prediction', description: '10연속 적중', condition: '연속 적중 10회', check: ctx => ctx.maxConsecutiveCorrect >= 10 },
  { id: 'all_kill_1', emoji: '💥', name: '올킬', category: 'prediction', description: '하루 전 경기 적중', condition: '올킬 1회', check: ctx => ctx.allKillCount >= 1 },
  { id: 'all_kill_5', emoji: '☄️', name: '올킬 마스터', category: 'prediction', description: '올킬 5회 달성', condition: '올킬 5회', check: ctx => ctx.allKillCount >= 5 },

  // ── XP 성장 (7) ──
  { id: 'xp_100', emoji: '🫘', name: '씨앗', category: 'xp', description: '작은 씨앗이 심어졌다', condition: '누적 XP 100', check: ctx => ctx.totalXp >= 100 },
  { id: 'xp_500', emoji: '🌿', name: '새싹', category: 'xp', description: '새싹이 돋아나다', condition: '누적 XP 500', check: ctx => ctx.totalXp >= 500 },
  { id: 'xp_1000', emoji: '🌳', name: '묘목', category: 'xp', description: '묘목으로 자라다', condition: '누적 XP 1,000', check: ctx => ctx.totalXp >= 1000 },
  { id: 'xp_3000', emoji: '🌲', name: '나무', category: 'xp', description: '단단한 나무가 되다', condition: '누적 XP 3,000', check: ctx => ctx.totalXp >= 3000 },
  { id: 'xp_5000', emoji: '🏔️', name: '거목', category: 'xp', description: '거대한 거목', condition: '누적 XP 5,000', check: ctx => ctx.totalXp >= 5000 },
  { id: 'xp_10000', emoji: '🌍', name: '세계수', category: 'xp', description: '세계수에 도달하다', condition: '누적 XP 10,000', check: ctx => ctx.totalXp >= 10000 },
  { id: 'xp_50000', emoji: '🪐', name: '우주', category: 'xp', description: '우주로 뻗어나가다', condition: '누적 XP 50,000', check: ctx => ctx.totalXp >= 50000 },

  // ── 스트릭 (5) ──
  { id: 'streak_3', emoji: '🔥', name: '3일 연속', category: 'streak', description: '3일 연속 배치!', condition: '3일 연속 배치', check: ctx => ctx.maxStreak >= 3 },
  { id: 'streak_7', emoji: '📅', name: '주간 개근', category: 'streak', description: '일주일 개근', condition: '7일 연속 배치', check: ctx => ctx.maxStreak >= 7 },
  { id: 'streak_14', emoji: '🗓️', name: '2주 개근', category: 'streak', description: '2주 연속 개근', condition: '14일 연속 배치', check: ctx => ctx.maxStreak >= 14 },
  { id: 'streak_30', emoji: '🏅', name: '한 달 개근', category: 'streak', description: '한 달 내내 함께', condition: '30일 연속 배치', check: ctx => ctx.maxStreak >= 30 },
  { id: 'streak_100', emoji: '🐉', name: '전설의 근성', category: 'streak', description: '100일 연속 달성', condition: '100일 연속 배치', check: ctx => ctx.maxStreak >= 100 },

  // ── 수집 (3) ──
  { id: 'collector_10', emoji: '📚', name: '업적 입문', category: 'collection', description: '업적 10개 달성', condition: '업적 10개', check: ctx => ctx.earnedCount >= 10 },
  { id: 'collector_15', emoji: '🏆', name: '업적 수집가', category: 'collection', description: '업적 15개 달성', condition: '업적 15개', check: ctx => ctx.earnedCount >= 15 },
  { id: 'collector_25', emoji: '👑', name: '업적 마스터', category: 'collection', description: '업적 25개 달성', condition: '업적 25개', check: ctx => ctx.earnedCount >= 25 },
];

// ━━━ 카테고리 라벨 ━━━
export const CATEGORY_LABELS: Record<string, { emoji: string; name: string }> = {
  beginner:   { emoji: '👣', name: '입문' },
  prediction: { emoji: '🎯', name: '예측' },
  xp:         { emoji: '🌱', name: 'XP 성장' },
  streak:     { emoji: '🔥', name: '스트릭' },
  collection: { emoji: '🏆', name: '수집' },
};

// ━━━ 컨텍스트 빌드 ━━━
async function buildContext(userId: string, character: any): Promise<AchievementContext> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  // 배치 데이터 (튜토리얼 제외)
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

  for (const p of settledPlacements) {
    const netXp = (p.xpFromPlayer || 0) + (p.xpFromPrediction || 0);
    maxSinglePlacementXp = Math.max(maxSinglePlacementXp, netXp);
    if (netXp < 0) hasNegativeXp = true;

    if (p.isCorrect) {
      correctPredictions++;
      currentConsecutive++;
      maxConsecutiveCorrect = Math.max(maxConsecutiveCorrect, currentConsecutive);
    } else {
      failedPredictions++;
      currentConsecutive = 0;
    }
  }

  // 올킬 계산 (하루에 배치는 1개이므로, 배치 기반 올킬은 의미가 다름)
  // 배치 시스템에서는 "승리 예측 적중"이면 올킬 1회로 카운트
  // 향후 다중 배치 지원 시 날짜별로 계산
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
  };
}

// ━━━ 희귀도 순서 ━━━
const RARITY_ORDER = [
  'streak_100', 'xp_50000', 'correct_100', 'collector_25',
  'all_kill_5', 'correct_50', 'xp_10000', 'streak_correct_10', 'streak_30',
  'correct_30', 'xp_5000', 'streak_14', 'collector_15',
  'streak_correct_5', 'all_kill_1', 'xp_3000', 'streak_7',
  'correct_10', 'collector_10', 'placement_50',
  'streak_correct_3', 'xp_1000', 'xp_500', 'xp_100',
  'placement_10', 'correct_1', 'first_placement', 'streak_3',
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
