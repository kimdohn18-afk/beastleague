import { Character } from '../models/Character';
import { Prediction } from '../models/Prediction';
import { VirtualMatch } from '../models/VirtualMatch';
import { InventoryItem } from '../models/Inventory';
import { League } from '../models/League';
import { SET_BONUSES } from '../models/Item';
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
  // 예측
  totalPredictions: number;
  settledPredictions: number;
  correctPredictions: number;
  maxConsecutiveCorrect: number;
  allKillCount: number;
  failedPredictions: number;
  maxSinglePredictionXp: number;
  hasNegativeXp: boolean;

  // XP
  totalXp: number;
  currentXp: number;

  // 가상 경기
  totalMatches: number;
  matchWins: number;
  mvpCount: number;
  totalHits: number;
  totalDoubles: number;
  totalHomeRuns: number;
  totalWalks: number;
  totalStolenBases: number;
  totalRuns: number;
  totalErrors: number;
  errorlessGames: number;
  careerAvg: number;
  maxHitsInGame: number;
  maxHRInGame: number;

  // 능력치
  stats: { power: number; skill: number; agility: number; stamina: number; mind: number };
  totalStats: number;
  maxSingleStat: number;

  // 장비
  totalItems: number;
  equippedCount: number;
  legendaryCount: number;
  epicCount: number;
  maxEnhanceLevel: number;
  completedSetCount: number;
  enhance10Count: number;
  enhanceFailCount: number;

  // 스트릭
  currentStreak: number;
  maxStreak: number;

  // 소셜
  leagueCount: number;

  // 수집
  earnedCount: number;
}

// ━━━ 업적 정의 (60개) ━━━
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ── 입문 (7) ──
  { id: 'first_prediction', emoji: '🔮', name: '첫 예측', category: 'beginner', description: '첫 예측을 했다!', condition: '예측 1회', check: ctx => ctx.totalPredictions >= 1 },
  { id: 'first_match', emoji: '⚾', name: '첫 경기', category: 'beginner', description: '첫 가상 경기 출전', condition: '경기 뛰기 1회', check: ctx => ctx.totalMatches >= 1 },
  { id: 'first_item', emoji: '🎁', name: '첫 아이템', category: 'beginner', description: '첫 아이템을 획득했다', condition: '아이템 1개 보유', check: ctx => ctx.totalItems >= 1 },
  { id: 'first_equip', emoji: '🛡️', name: '첫 장착', category: 'beginner', description: '장비를 장착했다', condition: '장비 1개 장착', check: ctx => ctx.equippedCount >= 1 },
  { id: 'first_league', emoji: '🤝', name: '첫 리그', category: 'beginner', description: '리그에 참가했다', condition: '리그 1회 가입', check: ctx => ctx.leagueCount >= 1 },
  { id: 'full_equip', emoji: '⚔️', name: '풀장비', category: 'beginner', description: '모든 슬롯에 장비 장착', condition: '5슬롯 모두 장착', check: ctx => ctx.equippedCount >= 5 },
  { id: 'first_upgrade', emoji: '📈', name: '첫 성장', category: 'beginner', description: '능력치를 올렸다', condition: '총 능력치 6 이상', check: ctx => ctx.totalStats >= 6 },

  // ── 예측 (10) ──
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

  // ── 가상 경기 (12) ──
  { id: 'match_10', emoji: '🏟️', name: '경기 10회', category: 'match', description: '10경기 출전', condition: '가상 경기 10회', check: ctx => ctx.totalMatches >= 10 },
  { id: 'match_50', emoji: '📋', name: '레귤러', category: 'match', description: '50경기 출전', condition: '가상 경기 50회', check: ctx => ctx.totalMatches >= 50 },
  { id: 'match_100', emoji: '🏅', name: '철인', category: 'match', description: '100경기 출전', condition: '가상 경기 100회', check: ctx => ctx.totalMatches >= 100 },
  { id: 'win_10', emoji: '✌️', name: '10승', category: 'match', description: '10승 달성', condition: '가상 경기 10승', check: ctx => ctx.matchWins >= 10 },
  { id: 'win_50', emoji: '🏆', name: '50승', category: 'match', description: '50승 달성', condition: '가상 경기 50승', check: ctx => ctx.matchWins >= 50 },
  { id: 'mvp_1', emoji: '⭐', name: '첫 MVP', category: 'match', description: 'MVP 첫 수상', condition: 'MVP 1회', check: ctx => ctx.mvpCount >= 1 },
  { id: 'mvp_10', emoji: '🌟', name: 'MVP 단골', category: 'match', description: 'MVP 10회 수상', condition: 'MVP 10회', check: ctx => ctx.mvpCount >= 10 },
  { id: 'mvp_30', emoji: '👑', name: 'MVP 제조기', category: 'match', description: 'MVP 30회 수상', condition: 'MVP 30회', check: ctx => ctx.mvpCount >= 30 },
  { id: 'hr_10', emoji: '💥', name: '홈런 10개', category: 'match', description: '통산 홈런 10개', condition: '통산 홈런 10', check: ctx => ctx.totalHomeRuns >= 10 },
  { id: 'hr_50', emoji: '🔥', name: '홈런왕', category: 'match', description: '통산 홈런 50개', condition: '통산 홈런 50', check: ctx => ctx.totalHomeRuns >= 50 },
  { id: 'avg_300', emoji: '🏏', name: '3할 타자', category: 'match', description: '통산 타율 .300 이상', condition: '통산 타율 .300+', check: ctx => ctx.totalMatches >= 10 && ctx.careerAvg >= 0.300 },
  { id: 'errorless_10', emoji: '🧤', name: '철벽 수비', category: 'match', description: '무실책 경기 10회', condition: '무실책 10경기', check: ctx => ctx.errorlessGames >= 10 },

  // ── 능력치 (8) ──
  { id: 'stats_total_20', emoji: '💪', name: '훈련 시작', category: 'stats', description: '총 능력치 20 달성', condition: '총 능력치 20', check: ctx => ctx.totalStats >= 20 },
  { id: 'stats_total_50', emoji: '🔱', name: '중급 선수', category: 'stats', description: '총 능력치 50 달성', condition: '총 능력치 50', check: ctx => ctx.totalStats >= 50 },
  { id: 'stats_total_100', emoji: '⚡', name: '엘리트', category: 'stats', description: '총 능력치 100 달성', condition: '총 능력치 100', check: ctx => ctx.totalStats >= 100 },
  { id: 'stats_total_200', emoji: '🐉', name: '초월자', category: 'stats', description: '총 능력치 200 달성', condition: '총 능력치 200', check: ctx => ctx.totalStats >= 200 },
  { id: 'stats_total_495', emoji: '🌌', name: '만렙', category: 'stats', description: '올스탯 99 달성', condition: '총 능력치 495', check: ctx => ctx.totalStats >= 495 },
  { id: 'single_stat_30', emoji: '🎯', name: '특화형', category: 'stats', description: '단일 능력치 30 달성', condition: '한 스탯 30 이상', check: ctx => ctx.maxSingleStat >= 30 },
  { id: 'single_stat_50', emoji: '🏹', name: '달인', category: 'stats', description: '단일 능력치 50 달성', condition: '한 스탯 50 이상', check: ctx => ctx.maxSingleStat >= 50 },
  { id: 'single_stat_99', emoji: '♾️', name: '극한', category: 'stats', description: '단일 능력치 99 달성', condition: '한 스탯 99', check: ctx => ctx.maxSingleStat >= 99 },

  // ── 장비 (9) ──
  { id: 'items_10', emoji: '📦', name: '수집가', category: 'equipment', description: '아이템 10개 보유', condition: '아이템 10개', check: ctx => ctx.totalItems >= 10 },
  { id: 'items_30', emoji: '🏛️', name: '창고지기', category: 'equipment', description: '아이템 30개 보유', condition: '아이템 30개', check: ctx => ctx.totalItems >= 30 },
  { id: 'epic_1', emoji: '💜', name: '에픽 획득', category: 'equipment', description: '에픽 아이템 첫 획득', condition: '에픽 1개', check: ctx => ctx.epicCount >= 1 },
  { id: 'legendary_1', emoji: '🌈', name: '전설 획득', category: 'equipment', description: '전설 아이템 첫 획득!', condition: '전설 1개', check: ctx => ctx.legendaryCount >= 1 },
  { id: 'legendary_5', emoji: '✨', name: '전설 수집가', category: 'equipment', description: '전설 아이템 5개', condition: '전설 5개', check: ctx => ctx.legendaryCount >= 5 },
  { id: 'enhance_5', emoji: '🔨', name: '강화 +5', category: 'equipment', description: '아이템 +5 강화 달성', condition: '강화 +5 아이템 보유', check: ctx => ctx.maxEnhanceLevel >= 5 },
  { id: 'enhance_10', emoji: '⚒️', name: '강화 마스터', category: 'equipment', description: '+10 강화 달성!', condition: '강화 +10 아이템 보유', check: ctx => ctx.enhance10Count >= 1 },
  { id: 'set_complete', emoji: '🔮', name: '세트 완성', category: 'equipment', description: '세트 효과 발동!', condition: '세트 효과 1개 활성', check: ctx => ctx.completedSetCount >= 1 },
  { id: 'enhance_fail_10', emoji: '💔', name: '강화의 아픔', category: 'equipment', description: '강화 실패도 경험이다', condition: '강화 실패 10회', check: ctx => ctx.enhanceFailCount >= 10 },

  // ── 스트릭 (5) ──
  { id: 'streak_3', emoji: '🔥', name: '3일 연속', category: 'streak', description: '3일 연속 접속!', condition: '3일 연속 예측', check: ctx => ctx.maxStreak >= 3 },
  { id: 'streak_7', emoji: '📅', name: '주간 개근', category: 'streak', description: '일주일 개근', condition: '7일 연속 예측', check: ctx => ctx.maxStreak >= 7 },
  { id: 'streak_14', emoji: '🗓️', name: '2주 개근', category: 'streak', description: '2주 연속 개근', condition: '14일 연속 예측', check: ctx => ctx.maxStreak >= 14 },
  { id: 'streak_30', emoji: '🏅', name: '한 달 개근', category: 'streak', description: '한 달 내내 함께', condition: '30일 연속 예측', check: ctx => ctx.maxStreak >= 30 },
  { id: 'streak_100', emoji: '🐉', name: '전설의 근성', category: 'streak', description: '100일 연속 달성', condition: '100일 연속 예측', check: ctx => ctx.maxStreak >= 100 },

  // ── 수집 (2) ──
  { id: 'collector_15', emoji: '🏆', name: '업적 수집가', category: 'collection', description: '업적 15개 달성', condition: '업적 15개', check: ctx => ctx.earnedCount >= 15 },
  { id: 'collector_30', emoji: '👑', name: '업적 마스터', category: 'collection', description: '업적 30개 달성', condition: '업적 30개', check: ctx => ctx.earnedCount >= 30 },
];

// ━━━ 카테고리 라벨 ━━━
export const CATEGORY_LABELS: Record<string, { emoji: string; name: string }> = {
  beginner:   { emoji: '👣', name: '입문' },
  prediction: { emoji: '🎯', name: '예측' },
  xp:         { emoji: '🌱', name: 'XP 성장' },
  match:      { emoji: '⚾', name: '가상 경기' },
  stats:      { emoji: '💪', name: '능력치' },
  equipment:  { emoji: '🛡️', name: '장비' },
  streak:     { emoji: '🔥', name: '스트릭' },
  collection: { emoji: '🏆', name: '수집' },
};

// ━━━ 컨텍스트 빌드 ━━━
async function buildContext(userId: string, character: any): Promise<AchievementContext> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  // 예측 데이터
  const predictions = await Prediction.find({ userId: userObjId }).sort({ date: 1 }).lean();
  const settledPredictions = predictions.filter(p => p.status === 'settled');

  let correctPredictions = 0;
  let failedPredictions = 0;
  let maxConsecutiveCorrect = 0;
  let currentConsecutive = 0;
  let maxSinglePredictionXp = 0;
  let hasNegativeXp = false;
  let allKillCount = 0;

  // 날짜별 올킬 계산
  const dateMap = new Map<string, { total: number; correct: number }>();

  for (const p of settledPredictions) {
    const netXp = p.result?.netXp || 0;
    maxSinglePredictionXp = Math.max(maxSinglePredictionXp, netXp);
    if (netXp < 0) hasNegativeXp = true;

    if (p.result?.winCorrect) {
      correctPredictions++;
      currentConsecutive++;
      maxConsecutiveCorrect = Math.max(maxConsecutiveCorrect, currentConsecutive);
    } else {
      failedPredictions++;
      currentConsecutive = 0;
    }

    // 올킬 집계
    const d = dateMap.get(p.date) || { total: 0, correct: 0 };
    d.total++;
    if (p.result?.winCorrect) d.correct++;
    dateMap.set(p.date, d);
  }

  for (const [, d] of dateMap) {
    if (d.total >= 2 && d.total === d.correct) allKillCount++;
  }

  // 스트릭 계산
  const predDates = [...new Set(predictions.map(p => p.date))].sort();
  let maxStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < predDates.length; i++) {
    if (i === 0) { currentStreak = 1; }
    else {
      const prev = new Date(predDates[i - 1]);
      const curr = new Date(predDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      currentStreak = diff === 1 ? currentStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
  }

  // 가상 경기 데이터
  const matches = await VirtualMatch.find({ userId: userObjId, status: 'claimed' }).lean();
  let matchWins = 0;
  let mvpCount = 0;
  let totalHits = 0;
  let totalDoubles = 0;
  let totalHomeRuns = 0;
  let totalWalks = 0;
  let totalStolenBases = 0;
  let totalRuns = 0;
  let totalErrors = 0;
  let errorlessGames = 0;
  let totalAtBats = 0;
  let maxHitsInGame = 0;
  let maxHRInGame = 0;

  for (const m of matches) {
    if (m.result.win) matchWins++;
    if (m.result.personal.mvp) mvpCount++;
    totalHits += m.result.personal.hits;
    totalDoubles += m.result.personal.doubles;
    totalHomeRuns += m.result.personal.homeRuns;
    totalWalks += m.result.personal.walks;
    totalStolenBases += m.result.personal.stolenBases;
    totalRuns += m.result.personal.runs;
    totalErrors += m.result.personal.errors;
    totalAtBats += m.result.personal.atBats;
    if (m.result.personal.errors === 0) errorlessGames++;
    maxHitsInGame = Math.max(maxHitsInGame, m.result.personal.hits);
    maxHRInGame = Math.max(maxHRInGame, m.result.personal.homeRuns);
  }

  const careerAvg = totalAtBats > 0 ? totalHits / totalAtBats : 0;

  // 능력치
  const stats = character.stats || { power: 1, skill: 1, agility: 1, stamina: 1, mind: 1 };
  const totalStats = stats.power + stats.skill + stats.agility + stats.stamina + stats.mind;
  const maxSingleStat = Math.max(stats.power, stats.skill, stats.agility, stats.stamina, stats.mind);

  // 장비 데이터
  const items = await InventoryItem.find({ userId: userObjId }).lean();
  const equippedItems = items.filter(i => i.equipped);
  const legendaryCount = items.filter(i => i.rarity === 'legendary').length;
  const epicCount = items.filter(i => i.rarity === 'epic').length;
  const maxEnhanceLevel = items.reduce((max, i) => Math.max(max, i.enhanceLevel || 0), 0);
  const enhance10Count = items.filter(i => (i.enhanceLevel || 0) >= 10).length;

  // 세트 효과 활성 수
  const setCounts: Record<string, number> = {};
  for (const item of equippedItems) {
    if (item.setId) setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
  }
  let completedSetCount = 0;
  for (const setDef of SET_BONUSES) {
    const count = setCounts[setDef.setId] || 0;
    if (setDef.bonuses.some(b => count >= b.count)) completedSetCount++;
  }

  // 강화 실패 횟수 (Character에 저장하는 게 이상적이지만, 지금은 0으로)
  const enhanceFailCount = (character as any).enhanceFailCount || 0;

  // 리그
  const leagueCount = await League.countDocuments({ members: userObjId });

  return {
    totalPredictions: predictions.length,
    settledPredictions: settledPredictions.length,
    correctPredictions,
    maxConsecutiveCorrect,
    allKillCount,
    failedPredictions,
    maxSinglePredictionXp,
    hasNegativeXp,
    totalXp: character.totalXp || character.xp || 0,
    currentXp: character.currentXp || character.xp || 0,
    totalMatches: matches.length,
    matchWins,
    mvpCount,
    totalHits,
    totalDoubles,
    totalHomeRuns,
    totalWalks,
    totalStolenBases,
    totalRuns,
    totalErrors,
    errorlessGames,
    careerAvg,
    maxHitsInGame,
    maxHRInGame,
    stats,
    totalStats,
    maxSingleStat,
    totalItems: items.length,
    equippedCount: equippedItems.length,
    legendaryCount,
    epicCount,
    maxEnhanceLevel,
    completedSetCount,
    enhance10Count,
    enhanceFailCount,
    currentStreak,
    maxStreak,
    leagueCount,
    earnedCount: 0,
  };
}

// ━━━ 희귀도 순서 ━━━
const RARITY_ORDER = [
  'stats_total_495', 'single_stat_99', 'streak_100', 'xp_50000', 'correct_100',
  'collector_30', 'mvp_30', 'hr_50', 'win_50', 'match_100',
  'stats_total_200', 'legendary_5', 'enhance_10', 'streak_30', 'all_kill_5',
  'correct_50', 'xp_10000', 'single_stat_50', 'streak_correct_10',
  'stats_total_100', 'avg_300', 'match_50', 'xp_5000', 'correct_30',
  'streak_14', 'collector_15', 'items_30', 'set_complete',
  'single_stat_30', 'stats_total_50', 'win_10', 'mvp_10', 'hr_10',
  'errorless_10', 'enhance_5', 'epic_1', 'streak_correct_5', 'all_kill_1',
  'xp_3000', 'streak_7', 'correct_10', 'match_10', 'items_10',
  'legendary_1', 'streak_correct_3', 'enhance_fail_10',
  'stats_total_20', 'xp_1000', 'xp_500', 'xp_100',
  'full_equip', 'first_upgrade', 'first_league', 'first_equip',
  'first_item', 'first_match', 'first_prediction',
  'streak_3',
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
