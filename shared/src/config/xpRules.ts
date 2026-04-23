// shared/src/config/xpRules.ts

// === 타자 기록 XP ===
export const BATTER_XP = {
  HIT: 8,           // 안타 (1루타)
  DOUBLE: 12,       // 2루타
  TRIPLE: 20,       // 3루타
  HR: 40,           // 홈런
  RBI: 12,          // 타점
  RUN: 8,           // 득점
  SB: 15,           // 도루
  SB_FAIL: -10,     // 도루실패
  WALK_OFF: 25,     // 끝내기 안타
  NO_HIT_PENALTY: -15,  // 무안타 (3타석 이상)
} as const;

// === 팀 승리 & 예측 ===
export const TEAM_WIN_XP = 25;           // 배치한 팀이 이기면
export const WIN_PREDICT_XP = 25;        // 승리팀 예측 적중
export const WIN_PREDICT_FAIL_XP = 0;    // 실패 시 손해 없음

// === 올킬 보너스 ===
export const ALL_KILL_BONUS = 30;

// === 배치 제한 ===
export const MAX_PLACEMENTS_PER_DAY = 1;

// === 하위호환 (삭제 예정) ===
export const DIFF_MULTIPLIER = {
  '1-2': 1.5,
  '3-4': 2.0,
  '5+': 3.0,
} as const;

export const TOTAL_RUNS_MULTIPLIER = {
  low: 2.0,
  normal: 1.5,
  high: 2.5,
} as const;

export const TOTAL_RUNS_RANGE = {
  low: { min: 0, max: 5 },
  normal: { min: 6, max: 9 },
  high: { min: 10, max: Infinity },
} as const;

export const MAX_BET_PER_GAME = 500;
export const MAX_PREDICTIONS_PER_DAY = 5;
