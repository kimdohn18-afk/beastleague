export const BATTER_XP = {
  HIT: 8,
  DOUBLE: 12,
  TRIPLE: 20,
  HR: 40,
  RBI: 12,
  RUN: 8,
  SB: 15,
  SB_FAIL: -10,
  WALK: 10,
  WALK_OFF: 25,
  NO_HIT_PENALTY: -15,
} as const;

export const TEAM_WIN_XP = 25;
export const WIN_PREDICT_XP = 25;
export const WIN_PREDICT_FAIL_XP = 0;

export const ALL_KILL_BONUS = 30;

export const MAX_PLACEMENTS_PER_DAY = 1;

// deprecated aliases (하위 호환)
export const MAX_PREDICTIONS_PER_DAY = MAX_PLACEMENTS_PER_DAY;
export const MAX_BET_PER_GAME = 0;
export const DIFF_MULTIPLIER = 1;
export const TOTAL_RUNS_MULTIPLIER = 1;
export const TOTAL_RUNS_RANGE = { min: 0, max: 0 };
