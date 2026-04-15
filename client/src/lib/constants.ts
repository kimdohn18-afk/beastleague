// ──────────────────────────────────────────────
// 공통 상수 — 여러 페이지에서 import하여 사용
// ──────────────────────────────────────────────

export const ANIMAL_EMOJI: Record<string, string> = {
  turtle: '🐢', eagle: '🦅', lion: '🦁', dinosaur: '🦖', dog: '🐶',
  fox: '🦊', penguin: '🐧', shark: '🦈', bear: '🐻', tiger: '🐯',
  seagull: '🕊️', dragon: '🐉', cat: '🐱', rabbit: '🐰',
  gorilla: '🦍', elephant: '🐘',
};

export const ANIMAL_NAMES: Record<string, string> = {
  turtle: '거북이', eagle: '독수리', lion: '사자', dinosaur: '공룡', dog: '강아지',
  fox: '여우', penguin: '펭귄', shark: '상어', bear: '곰', tiger: '호랑이',
  seagull: '갈매기', dragon: '드래곤', cat: '고양이', rabbit: '토끼',
  gorilla: '고릴라', elephant: '코끼리',
};

export const PIXEL_ART_ANIMALS = [
  'turtle', 'eagle', 'lion', 'dinosaur', 'dog',
  'fox', 'penguin', 'shark', 'bear', 'tiger',
  'seagull', 'dragon', 'cat', 'rabbit', 'gorilla', 'elephant',
];

export const TRAIT_DISPLAY: Record<string, { emoji: string; name: string; desc: string }> = {
  prophet:              { emoji: '🔮', name: '예언자', desc: '경기의 흐름을 읽는 자' },
  oracle:               { emoji: '🔮', name: '신탁', desc: '거의 틀리지 않는 경지' },
  hr_hunter:            { emoji: '💣', name: '홈런 헌터', desc: '한두 번이 아니다, 대포 노선' },
  hr_master:            { emoji: '💥', name: '홈런 마스터', desc: '홈런 타순을 꿰뚫는 경지' },
  speedster:            { emoji: '🏃', name: '스피드스터', desc: '빠른 선수를 찾는 감각' },
  hit_machine:          { emoji: '🛡️', name: '안타 제조기', desc: '거의 매번 안타가 나온다' },
  rbi_collector:        { emoji: '🎯', name: '타점 수집가', desc: '타점이 꾸준히 따라오는 선구안' },
  reverse_prophet:      { emoji: '🎰', name: '역예측왕', desc: '예측은 빗나가도 배치는 계속된다' },
  run_radar:            { emoji: '🏅', name: '득점 레이더', desc: '득점 냄새를 맡는 자' },
  walkoff_magnet:       { emoji: '🔗', name: '끝내기 체질', desc: '끝내기를 부르는 손' },
  caught_stealing_king: { emoji: '⚠️', name: '도루 실패왕', desc: '도전은 했지만 결과는...' },
  nohit_survivor:       { emoji: '📊', name: '무안타 서바이버', desc: '바닥을 찍고도 살아남았다' },
  leadoff_maniac:       { emoji: '⚡', name: '리드오프 마니아', desc: '시작은 1번 타자부터' },
  cleanup_killer:       { emoji: '🔨', name: '클린업 킬러', desc: '중심타선만 노린다' },
  lower_gambler:        { emoji: '🔧', name: '하위타선 도박사', desc: '남들이 안 보는 곳에서 XP를 캔다' },
  order_nomad:          { emoji: '🎪', name: '타순 유목민', desc: '매번 다른 타순에 도전' },
  four_obsession:       { emoji: '4️⃣', name: '4번 집착', desc: '4번이 아니면 배치가 아니다' },
  full_count:           { emoji: '🔄', name: '풀카운트', desc: '모든 타순을 경험한 탐험가' },
  second_artisan:       { emoji: '2️⃣', name: '2번 장인', desc: '연결 타순의 미학' },
  odd_even_master:      { emoji: '🎲', name: '홀짝 마스터', desc: '본인만의 규칙이 있다' },
  one_team:             { emoji: '❤️', name: '원팀 충성파', desc: '한 팀만을 위한 배치' },
  team_explorer:        { emoji: '🎲', name: '팀 탐험가', desc: '오늘은 어디에 배치할까' },
  all_team_conqueror:   { emoji: '🗺️', name: '전팀 정복자', desc: 'KBO 전 구단을 경험한 자' },
  home_maniac:          { emoji: '🏠', name: '홈 매니아', desc: '홈 어드밴티지를 믿는다' },
  away_expert:          { emoji: '✈️', name: '원정 전문가', desc: '원정의 긴장감을 즐기는 자' },
  drifter:              { emoji: '🔀', name: '승부사', desc: '한 곳에 정착하지 않는다' },
  tragic_fan:           { emoji: '💔', name: '비운의 팬', desc: '사랑하지만 승리가 따르지 않는다' },
  sprout:               { emoji: '🌱', name: '새싹', desc: '여정의 시작' },
  ten_milestone:        { emoji: '🐣', name: '10회 돌파', desc: '이제 진짜 시작이다' },
  streak_7:             { emoji: '🔥', name: '연속 배치왕', desc: '일주일을 불태우다' },
  streak_14:            { emoji: '🔥', name: '불꽃 투혼', desc: '2주 연속, 멈출 수 없다' },
  streak_30:            { emoji: '👑', name: '철인', desc: '한 달을 관통하는 집념' },
  attendance_50:        { emoji: '📅', name: '개근상', desc: '50번의 배치를 넘긴 베테랑' },
  veteran_100:          { emoji: '🎖️', name: '백전노장', desc: '100번의 전장을 거친 자' },
  allrounder:           { emoji: '💎', name: '올라운더', desc: '균형 잡힌 배치의 달인' },
  path_of_pain:         { emoji: '💀', name: '수라의 길', desc: '고통 속에서 단련되는 자' },
  xp_explosion:         { emoji: '🌟', name: 'XP 폭발', desc: '전설적인 한 판' },
  growth_curve:         { emoji: '📈', name: '성장 곡선', desc: '눈에 띄게 성장하는 중' },
  collector:            { emoji: '🏆', name: '컬렉터', desc: '뱃지 수집가 그 자체' },
  rollercoaster:        { emoji: '🎭', name: '반전왕', desc: '천국과 지옥을 오가는 자' },
  consistency:          { emoji: '🧊', name: '꾸준함의 미학', desc: '극적이진 않지만 절대 무너지지 않는다' },
  grand_slam:           { emoji: '🎯', name: '만루 홈런급', desc: '역대급 한 판을 기록한 자' },
};

/** 칭호 ID → "🔮 예언자 — "경기의 흐름을 읽는 자"" 형태 문자열 */
export function getTraitDisplay(traitId: string): string {
  const t = TRAIT_DISPLAY[traitId];
  if (!t) return '';
  return `${t.emoji} ${t.name} — "${t.desc}"`;
}
