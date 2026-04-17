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
// 업적 ID → 표시 매핑 (TraitCalculator의 ACHIEVEMENT_DEFINITIONS와 동기화)
export const ACHIEVEMENT_DISPLAY: Record<string, { emoji: string; name: string; desc: string }> = {
  first_placement: { emoji: '👣', name: '첫 발걸음', desc: '모험의 시작!' },
  rookie:          { emoji: '🌱', name: '루키', desc: '이제 좀 감이 온다' },
  regular:         { emoji: '🏠', name: '단골', desc: '매일 찾아오는 단골손님' },
  veteran:         { emoji: '⭐', name: '베테랑', desc: '노련한 베테랑' },
  ironman:         { emoji: '🦾', name: '철인', desc: '쉬지 않는 철인' },
  legend:          { emoji: '👑', name: '레전드', desc: '전설이 되다' },
  first_league:    { emoji: '🤝', name: '첫 리그 참가', desc: '함께하면 더 재밌지' },
  xp_seed:         { emoji: '🫘', name: '씨앗', desc: '작은 씨앗이 심어졌다' },
  xp_sprout:       { emoji: '🌿', name: '새싹', desc: '새싹이 돋아나다' },
  xp_sapling:      { emoji: '🌳', name: '묘목', desc: '묘목으로 자라다' },
  xp_tree:         { emoji: '🌲', name: '나무', desc: '단단한 나무가 되다' },
  xp_great_tree:   { emoji: '🏔️', name: '거목', desc: '거대한 거목' },
  xp_world_tree:   { emoji: '🌍', name: '세계수', desc: '세계수에 도달하다' },
  first_correct:   { emoji: '🎯', name: '첫 적중', desc: '감이 왔다!' },
  getting_it:      { emoji: '🔮', name: '감잡았다', desc: '점점 느낌이 온다' },
  prophet:         { emoji: '🧙‍♂️', name: '예언자', desc: '예언자의 눈' },
  divine:          { emoji: '👁️', name: '신들린', desc: '신이 내린 촉' },
  hot_streak:      { emoji: '🔥', name: '촉이 좋네', desc: '연속으로 맞추다니' },
  fortune_teller:  { emoji: '🃏', name: '점쟁이', desc: '점쟁이급 예측력' },
  first_hr:        { emoji: '💥', name: '첫 홈런', desc: '첫 홈런의 짜릿함' },
  hr_mania:        { emoji: '🔥', name: '홈런 매니아', desc: '홈런에 미치다' },
  hr_king:         { emoji: '🏆', name: '홈런왕', desc: '진정한 홈런왕' },
  extra_base:      { emoji: '💪', name: '장타력', desc: '장타의 달인' },
  first_steal:     { emoji: '💨', name: '도루 성공', desc: '바람처럼 빠르게' },
  speedster:       { emoji: '⚡', name: '스피드스터', desc: '도루의 신' },
  first_walkoff:   { emoji: '🎬', name: '끝내기', desc: '극적인 끝내기!' },
  walkoff_king:    { emoji: '🎭', name: '끝장왕', desc: '끝내기 전문가' },
  hit_machine:     { emoji: '🏏', name: '안타 제조기', desc: '안타가 쏟아진다' },
  rbi_king:        { emoji: '📊', name: '타점왕', desc: '득점권에서 강하다' },
  run_king:        { emoji: '🏃', name: '득점왕', desc: '홈을 밟는 달인' },
  streak_3:        { emoji: '🔥', name: '3일 연속', desc: '3일 연속 출석!' },
  streak_7:        { emoji: '📅', name: '주간 개근', desc: '일주일 개근' },
  streak_14:       { emoji: '🗓️', name: '2주 개근', desc: '2주 연속 개근' },
  streak_30:       { emoji: '🏅', name: '한 달 개근', desc: '한 달 내내 함께' },
  streak_60:       { emoji: '💪', name: '불꽃 의지', desc: '60일 연속의 의지' },
  streak_100:      { emoji: '🐉', name: '전설의 근성', desc: '100일 연속 달성' },
  big_hit:         { emoji: '💰', name: '대박', desc: '한방에 대박!' },
  jackpot:         { emoji: '🎰', name: '잭팟', desc: '잭팟 터졌다!' },
  explosion:       { emoji: '💣', name: '폭발', desc: 'XP 폭발!' },
  goat:            { emoji: '🐐', name: '역대급', desc: '역대급 한 경기' },
  order_explorer:  { emoji: '🧭', name: '타순 탐험가', desc: '모든 타순을 경험하다' },
  all_rounder:     { emoji: '🗺️', name: '올라운더', desc: '여러 팀을 넘나드는' },
  nationwide:      { emoji: '🇰🇷', name: '전국구', desc: '전국 10개 구단 정복' },
  collector_15:    { emoji: '📦', name: '수집가', desc: '업적 수집가' },
  collector_30:    { emoji: '🏛️', name: '컬렉터', desc: '진정한 컬렉터' },
  loss_hero:       { emoji: '😤', name: '역경의 승리자', desc: '져도 빛나는 사나이' },
  nohit_survivor:  { emoji: '😅', name: '노히트 생존자', desc: '무안타에도 굴하지 않는' },
  wrong_a_lot:     { emoji: '🙈', name: '예측 실패왕', desc: '틀려도 괜찮아' },
  lose_streak:     { emoji: '😭', name: '연패 체험', desc: '함께 아파하는 팬' },
  zero_xp:         { emoji: '💀', name: 'XP 0', desc: '바닥을 경험하다' },
  negative_xp:     { emoji: '🕳️', name: '바닥에서', desc: '마이너스도 경험이다' },
  // 팀 충성도 (teamId로 저장될 경우)
  samsung: { emoji: '🦁', name: '삼성 라이온즈', desc: '삼성 충성파' },
  kia:     { emoji: '🐯', name: '기아 타이거즈', desc: '기아 충성파' },
  lg:      { emoji: '🤞', name: 'LG 트윈스', desc: 'LG 충성파' },
  doosan:  { emoji: '🐻', name: '두산 베어스', desc: '두산 충성파' },
  kt:      { emoji: '🧙', name: 'KT 위즈', desc: 'KT 충성파' },
  ssg:     { emoji: '🛬', name: 'SSG 랜더스', desc: 'SSG 충성파' },
  lotte:   { emoji: '🦅', name: '롯데 자이언츠', desc: '롯데 충성파' },
  hanwha:  { emoji: '🦅', name: '한화 이글스', desc: '한화 충성파' },
  nc:      { emoji: '🦕', name: 'NC 다이노스', desc: 'NC 충성파' },
  kiwoom:  { emoji: '🦸', name: '키움 히어로즈', desc: '키움 충성파' },
};

export function getTraitDisplay(traitId: string): string {
  // 1) 기존 TRAIT_DISPLAY에서 찾기
  const t = TRAIT_DISPLAY[traitId];
  if (t) return `${t.emoji} ${t.name}`;
  
  // 2) 업적 ID에서 찾기
  const a = ACHIEVEMENT_DISPLAY[traitId];
  if (a) return `${a.emoji} ${a.name}`;
  
  // 3) 이미 "🦾 철인" 형식이면 그대로 반환 (하위 호환)
  if (traitId.includes(' ')) return traitId;
  
  return '';
}

// ──────────────────────────────────────────────
// 진화 시스템
// ──────────────────────────────────────────────

export interface EvolutionStage {
  stage: number;
  name: string;
  minXp: number;
  xpCost: number;          // 진화에 소모되는 XP
  requiredAchievements: number; // 필요 업적 수
  badge: string;
  color: string;
  borderColor: string;
  bgColor: string;
  glowColor: string;
}

export const EVOLUTION_STAGES: EvolutionStage[] = [
  { stage: 1, name: '아기',  minXp: 0,     xpCost: 0,     requiredAchievements: 0,  badge: '🥚', color: 'text-gray-500',   borderColor: 'border-gray-200', bgColor: 'bg-gray-50',   glowColor: 'transparent' },
  { stage: 2, name: '성장',  minXp: 200,   xpCost: 200,   requiredAchievements: 3,  badge: '⭐', color: 'text-yellow-500', borderColor: 'border-yellow-300', bgColor: 'bg-yellow-50', glowColor: '#fbbf24' },
  { stage: 3, name: '성숙',  minXp: 500,   xpCost: 500,   requiredAchievements: 8,  badge: '🔥', color: 'text-orange-500', borderColor: 'border-orange-300', bgColor: 'bg-orange-50', glowColor: '#f97316' },
  { stage: 4, name: '전설',  minXp: 1500,  xpCost: 1500,  requiredAchievements: 15, badge: '👑', color: 'text-purple-500', borderColor: 'border-purple-300', bgColor: 'bg-purple-50', glowColor: '#a855f7' },
  { stage: 5, name: '신화',  minXp: 5000,  xpCost: 5000,  requiredAchievements: 25, badge: '💎', color: 'text-cyan-400',   borderColor: 'border-cyan-300',   bgColor: 'bg-cyan-50',   glowColor: '#22d3ee' },
];

export function getEvolutionStage(xp: number): EvolutionStage {
  // 주의: 이제 자동 진화가 아니라 수동 진화이므로,
  // 이 함수는 "XP 기준 최대 가능 단계"를 반환합니다.
  // 실제 표시 단계는 서버의 evolvedStage 필드를 사용합니다.
  let current = EVOLUTION_STAGES[0];
  for (const stage of EVOLUTION_STAGES) {
    if (xp >= stage.minXp) current = stage;
  }
  return current;
}

export function getNextEvolutionStage(xp: number): EvolutionStage | null {
  for (const stage of EVOLUTION_STAGES) {
    if (xp < stage.minXp) return stage;
  }
  return null;
}

export const CHANGE_ANIMAL_COST = 100; // 캐릭터 변경 비용 (XP)
