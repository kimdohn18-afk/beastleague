// shared/src/config/xpRules.ts

// === 승리 예측 (무료) ===
export const WIN_PREDICT_XP = 20;        // 적중 시 +20
export const WIN_PREDICT_FAIL_XP = 0;    // 실패 시 0 (손해 없음)

// === 점수차 예측 (XP 베팅) ===
export const DIFF_MULTIPLIER = {
  '1-2': 1.5,
  '3-4': 2.0,
  '5+':  3.0,
} as const;

// === 총득점 예측 (XP 베팅) ===
// low: 0~5점, normal: 6~9점, high: 10점+
export const TOTAL_RUNS_MULTIPLIER = {
  low:    2.0,
  normal: 1.5,
  high:   2.5,
} as const;

export const TOTAL_RUNS_RANGE = {
  low:    { min: 0, max: 5 },
  normal: { min: 6, max: 9 },
  high:   { min: 10, max: Infinity },
} as const;

// === 올킬 보너스 ===
export const ALL_KILL_BONUS = 30;        // 당일 전 경기 승리 예측 적중 시

// === 베팅 제한 ===
export const MAX_BET_PER_GAME = 500;     // 한 경기당 최대 베팅 XP
export const MAX_PREDICTIONS_PER_DAY = 5; // 하루 최대 예측 경기 수
