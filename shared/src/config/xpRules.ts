// shared/src/config/xpRules.ts

// === 타자 기록 XP ===
export const BATTER_XP = {
  HIT: 8,            // 안타 (1루타)
  DOUBLE: 12,        // 2루타
  TRIPLE: 20,        // 3루타
  HR: 40,            // 홈런
  RBI: 12,           // 타점
  RUN: 8,            // 득점
  SB: 15,            // 도루
  SB_FAIL: -10,      // 도루실패
  WALK_OFF: 25,      // 끝내기 안타
  NO_HIT_PENALTY: -15, // 무안타 (3타석 이상)
} as const;

// === 팀 승리 & 예측 ===
export const TEAM_WIN_XP = 25;           // 배치한 팀이 이기면
export const WIN_PREDICT_XP = 25;        // 승리팀 예측 적중
export const WIN_PREDICT_FAIL_XP = 0;    // 실패 시 손해 없음

// === 올킬 보너스 ===
export const ALL_KILL_BONUS = 30;

// === 배치 제한 ===
export const MAX_PLACEMENTS_PER_DAY = 1;

// ──────────────────────────────────────────
// 하위호환 별칭 (기존 import 깨짐 방지용)
// → 서버·클라이언트에서 참조하는 곳을 모두 교체한 뒤 삭제할 것
// ──────────────────────────────────────────
/** @deprecated MAX_PLACEMENTS_PER_DAY 사용 */
export const MAX_PREDICTIONS_PER_DAY = MAX_PLACEMENTS_PER_DAY;

/** @deprecated 타순 기반 시스템에서 미사용 */
export const MAX_BET_PER_GAME = 0;

/** @deprecated 타순 기반 시스템에서 미사용 */
export const DIFF_MULTIPLIER = {
  '1-2': 1,
  '3-4': 1,
  '5+': 1,
} as const;

/** @deprecated 타순 기반 시스템에서 미사용 */
export const TOTAL_RUNS_MULTIPLIER = {
  low: 1,
  normal: 1,
  high: 1,
} as const;

/** @deprecated 타순 기반 시스템에서 미사용 */
export const TOTAL_RUNS_RANGE = {
  low: { min: 0, max: 0 },
  normal: { min: 0, max: 0 },
  high: { min: 0, max: 0 },
} as const;
