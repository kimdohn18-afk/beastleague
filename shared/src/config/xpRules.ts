export const XP_RULES = {
  // 기본 기록 (타순별 합산)
  hit: 8,           // 안타 1개당
  rbi: 12,          // 타점 1개당
  run: 8,           // 득점 1개당
  noHitPenalty: -15, // 무안타 (타수 3이상 & 0안타)
  noHitMinAB: 3,     // 무안타 판정 최소 타수

  // 이벤트 보너스 (선수 이름 매칭)
  homeRun: 40,
  double: 12,
  triple: 20,
  stolenBase: 15,
  caughtStealing: -10,
  walkOff: 25,       // 결승타

  // 팀 결과
  teamWin: 25,
  teamLose: 0,
};
