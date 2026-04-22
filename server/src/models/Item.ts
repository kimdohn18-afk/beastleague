import { Schema, model, Document, Types } from 'mongoose';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemSlot = 'bat' | 'glove' | 'shoes' | 'helmet' | 'accessory';

export interface IItemEffect {
  stat: string;
  value: number;
}

export interface IItemTemplate {
  templateId: string;
  name: string;
  description: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  effects: IItemEffect[];       // 복합 효과
  xpBonus?: number;             // XP 획득 보너스 (%)
  special?: string;             // 특수 효과 키
  setId?: string;               // 세트 소속
  icon: string;
}

export interface IItem extends Document {
  templateId: string;
  name: string;
  description: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  baseEffect: { stat?: string; value: number; xpBonus?: number }; // 하위호환
  icon: string;
}

const itemSchema = new Schema<IItem>(
  {
    templateId:  { type: String, required: true, unique: true },
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    slot:        { type: String, enum: ['bat', 'glove', 'shoes', 'helmet', 'accessory'], required: true },
    rarity:      { type: String, enum: ['common', 'rare', 'epic', 'legendary'], required: true },
    baseEffect: {
      stat:    { type: String },
      value:   { type: Number, default: 0 },
      xpBonus: { type: Number, default: 0 },
    },
    icon: { type: String, default: '📦' },
  },
  { timestamps: true }
);

export const Item = model<IItem>('Item', itemSchema);

// ── 세트 정의 ──
export interface ISetBonus {
  setId: string;
  name: string;
  bonuses: { count: number; effects: IItemEffect[]; xpBonus?: number; description: string }[];
}

export const SET_BONUSES: ISetBonus[] = [
  {
    setId: 'rookie',
    name: '루키 세트',
    bonuses: [
      { count: 3, effects: [{ stat: 'power', value: 1 }, { stat: 'skill', value: 1 }], description: '파워 +1, 기술 +1' },
      { count: 5, effects: [{ stat: 'power', value: 2 }, { stat: 'skill', value: 2 }, { stat: 'agility', value: 2 }, { stat: 'stamina', value: 2 }, { stat: 'mind', value: 2 }], description: '전 스탯 +2' },
    ],
  },
  {
    setId: 'slugger',
    name: '슬러거 세트',
    bonuses: [
      { count: 2, effects: [{ stat: 'power', value: 3 }], description: '파워 +3' },
      { count: 4, effects: [{ stat: 'power', value: 5 }, { stat: 'skill', value: 3 }], description: '파워 +5, 기술 +3' },
    ],
  },
  {
    setId: 'speedster',
    name: '스피드스터 세트',
    bonuses: [
      { count: 2, effects: [{ stat: 'agility', value: 3 }], description: '민첩 +3' },
      { count: 4, effects: [{ stat: 'agility', value: 5 }, { stat: 'mind', value: 3 }], description: '민첩 +5, 정신 +3' },
    ],
  },
  {
    setId: 'fortress',
    name: '철벽 수비 세트',
    bonuses: [
      { count: 2, effects: [{ stat: 'stamina', value: 3 }], description: '체력 +3' },
      { count: 4, effects: [{ stat: 'stamina', value: 5 }, { stat: 'agility', value: 2 }], description: '체력 +5, 민첩 +2' },
    ],
  },
  {
    setId: 'legend',
    name: '레전드 세트',
    bonuses: [
      { count: 3, effects: [{ stat: 'power', value: 3 }, { stat: 'skill', value: 3 }, { stat: 'agility', value: 3 }], description: '파워/기술/민첩 +3' },
      { count: 5, effects: [{ stat: 'power', value: 5 }, { stat: 'skill', value: 5 }, { stat: 'agility', value: 5 }, { stat: 'stamina', value: 5 }, { stat: 'mind', value: 5 }], xpBonus: 10, description: '전 스탯 +5, XP +10%' },
    ],
  },
];

// ── 아이템 템플릿 (50종) ──
export const ITEM_TEMPLATES: IItemTemplate[] = [
  // ===== 배트 (10종) =====
  // 일반
  { templateId: 'bat_wood',        name: '나무 배트',       slot: 'bat', rarity: 'common',    icon: '🏏', description: '기본 나무 배트',             effects: [{ stat: 'power', value: 1 }], setId: 'rookie' },
  { templateId: 'bat_practice',    name: '연습용 배트',     slot: 'bat', rarity: 'common',    icon: '🪵', description: '스윙 연습에 최적화',          effects: [{ stat: 'skill', value: 1 }] },
  // 레어
  { templateId: 'bat_aluminum',    name: '알루미늄 배트',   slot: 'bat', rarity: 'rare',      icon: '⚾', description: '가벼운 알루미늄 배트',       effects: [{ stat: 'power', value: 3 }], setId: 'slugger' },
  { templateId: 'bat_precision',   name: '정밀 배트',       slot: 'bat', rarity: 'rare',      icon: '🎯', description: '정확한 컨택을 위한 배트',     effects: [{ stat: 'skill', value: 2 }, { stat: 'power', value: 1 }] },
  { templateId: 'bat_speed',       name: '경량 배트',       slot: 'bat', rarity: 'rare',      icon: '💨', description: '빠른 스윙이 가능한 배트',     effects: [{ stat: 'agility', value: 2 }, { stat: 'power', value: 1 }], setId: 'speedster' },
  // 에픽
  { templateId: 'bat_carbon',      name: '카본 배트',       slot: 'bat', rarity: 'epic',      icon: '🔥', description: '고탄성 카본 배트',           effects: [{ stat: 'power', value: 5 }], setId: 'slugger' },
  { templateId: 'bat_master',      name: '마스터 배트',     slot: 'bat', rarity: 'epic',      icon: '⭐', description: '달인의 배트',                effects: [{ stat: 'power', value: 3 }, { stat: 'skill', value: 3 }] },
  { templateId: 'bat_clutch',      name: '끝내기 배트',     slot: 'bat', rarity: 'epic',      icon: '💥', description: '결정적 순간에 빛나는 배트',   effects: [{ stat: 'power', value: 3 }, { stat: 'mind', value: 3 }], setId: 'fortress' },
  // 전설
  { templateId: 'bat_legend',      name: '전설의 배트',     slot: 'bat', rarity: 'legendary', icon: '⚡', description: '전설적인 힘이 깃든 배트',     effects: [{ stat: 'power', value: 8 }], xpBonus: 5, setId: 'legend' },
  { templateId: 'bat_grandslam',   name: '그랜드슬램 배트', slot: 'bat', rarity: 'legendary', icon: '🏆', description: '만루홈런의 전설',             effects: [{ stat: 'power', value: 6 }, { stat: 'skill', value: 4 }], xpBonus: 3 },

  // ===== 글러브 (10종) =====
  { templateId: 'glove_leather',   name: '가죽 글러브',     slot: 'glove', rarity: 'common',    icon: '🧤', description: '기본 가죽 글러브',           effects: [{ stat: 'skill', value: 1 }], setId: 'rookie' },
  { templateId: 'glove_training',  name: '트레이닝 글러브', slot: 'glove', rarity: 'common',    icon: '✋', description: '훈련용 글러브',              effects: [{ stat: 'stamina', value: 1 }] },
  { templateId: 'glove_pro',       name: '프로 글러브',     slot: 'glove', rarity: 'rare',      icon: '🥊', description: '프로용 글러브',              effects: [{ stat: 'skill', value: 3 }], setId: 'fortress' },
  { templateId: 'glove_web',       name: '웹 글러브',       slot: 'glove', rarity: 'rare',      icon: '🕸️', description: '넓은 포구면의 글러브',       effects: [{ stat: 'skill', value: 2 }, { stat: 'stamina', value: 1 }] },
  { templateId: 'glove_quick',     name: '퀵핸드 글러브',   slot: 'glove', rarity: 'rare',      icon: '👋', description: '빠른 송구를 위한 글러브',     effects: [{ stat: 'agility', value: 2 }, { stat: 'skill', value: 1 }], setId: 'speedster' },
  { templateId: 'glove_golden',    name: '골든 글러브',     slot: 'glove', rarity: 'epic',      icon: '✨', description: '골드글러브 수상작',           effects: [{ stat: 'skill', value: 5 }], setId: 'fortress' },
  { templateId: 'glove_allround',  name: '올라운드 글러브', slot: 'glove', rarity: 'epic',      icon: '🌟', description: '모든 포지션에 완벽한 글러브', effects: [{ stat: 'skill', value: 3 }, { stat: 'agility', value: 2 }, { stat: 'stamina', value: 1 }] },
  { templateId: 'glove_ironwall',  name: '철벽 글러브',     slot: 'glove', rarity: 'epic',      icon: '🛡️', description: '공이 절대 빠지지 않는 글러브', effects: [{ stat: 'skill', value: 3 }, { stat: 'stamina', value: 3 }], setId: 'slugger' },
  { templateId: 'glove_legend',    name: '전설의 글러브',   slot: 'glove', rarity: 'legendary', icon: '👑', description: '잡히지 않는 공이 없다',       effects: [{ stat: 'skill', value: 8 }], xpBonus: 5, setId: 'legend' },
  { templateId: 'glove_wizard',    name: '마법사의 글러브', slot: 'glove', rarity: 'legendary', icon: '🪄', description: '마법 같은 수비',              effects: [{ stat: 'skill', value: 5 }, { stat: 'mind', value: 4 }], xpBonus: 3 },

  // ===== 신발 (10종) =====
  { templateId: 'shoes_basic',     name: '운동화',          slot: 'shoes', rarity: 'common',    icon: '👟', description: '기본 운동화',                effects: [{ stat: 'agility', value: 1 }], setId: 'rookie' },
  { templateId: 'shoes_light',     name: '경량 운동화',     slot: 'shoes', rarity: 'common',    icon: '🦶', description: '가벼운 운동화',              effects: [{ stat: 'stamina', value: 1 }] },
  { templateId: 'shoes_spike',     name: '스파이크',        slot: 'shoes', rarity: 'rare',      icon: '👞', description: '접지력 좋은 스파이크',        effects: [{ stat: 'agility', value: 3 }], setId: 'speedster' },
  { templateId: 'shoes_power',     name: '파워 슈즈',       slot: 'shoes', rarity: 'rare',      icon: '🦵', description: '힘찬 발놀림을 위한 신발',     effects: [{ stat: 'agility', value: 1 }, { stat: 'power', value: 2 }], setId: 'slugger' },
  { templateId: 'shoes_balance',   name: '밸런스 슈즈',     slot: 'shoes', rarity: 'rare',      icon: '⚖️', description: '균형 잡힌 움직임',            effects: [{ stat: 'agility', value: 2 }, { stat: 'stamina', value: 1 }], setId: 'fortress' },
  { templateId: 'shoes_wind',      name: '질풍의 신발',     slot: 'shoes', rarity: 'epic',      icon: '🌊', description: '바람을 가르는 스피드',        effects: [{ stat: 'agility', value: 5 }], setId: 'speedster' },
  { templateId: 'shoes_steal',     name: '도루왕 스파이크', slot: 'shoes', rarity: 'epic',      icon: '🏃', description: '도루 성공률 극대화',          effects: [{ stat: 'agility', value: 4 }, { stat: 'mind', value: 2 }], special: 'stolenBoost' },
  { templateId: 'shoes_tank',      name: '탱크 슈즈',       slot: 'shoes', rarity: 'epic',      icon: '🪨', description: '흔들리지 않는 하체',          effects: [{ stat: 'stamina', value: 4 }, { stat: 'agility', value: 2 }], setId: 'fortress' },
  { templateId: 'shoes_legend',    name: '전설의 신발',     slot: 'shoes', rarity: 'legendary', icon: '🌪️', description: '빛보다 빠른 발걸음',          effects: [{ stat: 'agility', value: 8 }], xpBonus: 5, setId: 'legend' },
  { templateId: 'shoes_flash',     name: '섬광의 신발',     slot: 'shoes', rarity: 'legendary', icon: '⚡', description: '눈에 보이지 않는 스피드',     effects: [{ stat: 'agility', value: 6 }, { stat: 'skill', value: 3 }], xpBonus: 3 },

  // ===== 헬멧 (10종) =====
  { templateId: 'helmet_basic',    name: '기본 헬멧',       slot: 'helmet', rarity: 'common',    icon: '⛑️', description: '기본 보호 헬멧',             effects: [{ stat: 'stamina', value: 1 }], setId: 'rookie' },
  { templateId: 'helmet_focus',    name: '집중 헬멧',       slot: 'helmet', rarity: 'common',    icon: '🧢', description: '집중력을 높이는 헬멧',        effects: [{ stat: 'mind', value: 1 }] },
  { templateId: 'helmet_pro',      name: '프로 헬멧',       slot: 'helmet', rarity: 'rare',      icon: '🪖', description: '프로용 경량 헬멧',            effects: [{ stat: 'stamina', value: 3 }], setId: 'fortress' },
  { templateId: 'helmet_batter',   name: '타자 헬멧',       slot: 'helmet', rarity: 'rare',      icon: '🎩', description: '타석 집중력 향상 헬멧',       effects: [{ stat: 'mind', value: 2 }, { stat: 'power', value: 1 }], setId: 'slugger' },
  { templateId: 'helmet_aero',     name: '에어로 헬멧',     slot: 'helmet', rarity: 'rare',      icon: '💫', description: '공기역학적 헬멧',             effects: [{ stat: 'stamina', value: 2 }, { stat: 'agility', value: 1 }], setId: 'speedster' },
  { templateId: 'helmet_iron',     name: '강철 헬멧',       slot: 'helmet', rarity: 'epic',      icon: '🔩', description: '무적의 방어력',               effects: [{ stat: 'stamina', value: 5 }], setId: 'fortress' },
  { templateId: 'helmet_captain',  name: '캡틴 헬멧',       slot: 'helmet', rarity: 'epic',      icon: '🎖️', description: '팀의 리더가 쓰는 헬멧',      effects: [{ stat: 'mind', value: 4 }, { stat: 'stamina', value: 2 }], special: 'mvpBoost' },
  { templateId: 'helmet_zen',      name: '선구안 헬멧',     slot: 'helmet', rarity: 'epic',      icon: '👁️', description: '볼을 꿰뚫어보는 눈',         effects: [{ stat: 'mind', value: 4 }, { stat: 'skill', value: 2 }] },
  { templateId: 'helmet_legend',   name: '전설의 헬멧',     slot: 'helmet', rarity: 'legendary', icon: '💎', description: '전설의 보호막',               effects: [{ stat: 'stamina', value: 8 }], xpBonus: 5, setId: 'legend' },
  { templateId: 'helmet_invincible', name: '불멸의 헬멧',   slot: 'helmet', rarity: 'legendary', icon: '🔱', description: '절대 무너지지 않는 정신력',   effects: [{ stat: 'stamina', value: 5 }, { stat: 'mind', value: 5 }], xpBonus: 3 },

  // ===== 악세서리 (10종) =====
  { templateId: 'acc_band',        name: '손목밴드',        slot: 'accessory', rarity: 'common',    icon: '🔗', description: '집중력을 높이는 밴드',      effects: [{ stat: 'mind', value: 1 }], setId: 'rookie' },
  { templateId: 'acc_tape',        name: '손가락 테이프',   slot: 'accessory', rarity: 'common',    icon: '🩹', description: '그립감 향상',                effects: [{ stat: 'skill', value: 1 }] },
  { templateId: 'acc_chain',       name: '행운의 목걸이',   slot: 'accessory', rarity: 'rare',      icon: '📿', description: '행운을 부르는 목걸이',       effects: [{ stat: 'mind', value: 3 }], special: 'dropBoost' },
  { templateId: 'acc_wristguard',  name: '파워 손목보호대', slot: 'accessory', rarity: 'rare',      icon: '💪', description: '손목 힘을 극대화',            effects: [{ stat: 'power', value: 2 }, { stat: 'mind', value: 1 }], setId: 'slugger' },
  { templateId: 'acc_sunglasses',  name: '선글라스',        slot: 'accessory', rarity: 'rare',      icon: '🕶️', description: '태양빛을 차단하는 선글라스', effects: [{ stat: 'skill', value: 2 }, { stat: 'mind', value: 1 }], setId: 'speedster' },
  { templateId: 'acc_ring',        name: '챔피언 반지',     slot: 'accessory', rarity: 'epic',      icon: '💍', description: '챔피언의 정신력',             effects: [{ stat: 'mind', value: 5 }], setId: 'fortress' },
  { templateId: 'acc_allstat',     name: '올스탯 밴드',     slot: 'accessory', rarity: 'epic',      icon: '🌈', description: '모든 능력을 끌어올리는 밴드', effects: [{ stat: 'power', value: 2 }, { stat: 'skill', value: 2 }, { stat: 'agility', value: 2 }] },
  { templateId: 'acc_lucky',       name: '행운의 클로버',   slot: 'accessory', rarity: 'epic',      icon: '🍀', description: '행운이 깃든 부적',            effects: [{ stat: 'mind', value: 3 }, { stat: 'skill', value: 2 }], special: 'dropBoost', setId: 'speedster' },
  { templateId: 'acc_legend',      name: '전설의 부적',     slot: 'accessory', rarity: 'legendary', icon: '🏅', description: '전설의 집중력',               effects: [{ stat: 'mind', value: 8 }], xpBonus: 5, setId: 'legend' },
  { templateId: 'acc_infinity',    name: '무한의 팔찌',     slot: 'accessory', rarity: 'legendary', icon: '♾️', description: '끝없는 에너지',              effects: [{ stat: 'mind', value: 4 }, { stat: 'stamina', value: 4 }, { stat: 'power', value: 2 }], xpBonus: 3 },
];

// 등급별 드롭 확률
export const DROP_RATES: Record<string, { dropChance: number; rarityWeights: Record<ItemRarity, number> }> = {
  win:  { dropChance: 0.7,  rarityWeights: { common: 50, rare: 30, epic: 15, legendary: 5 } },
  mvp:  { dropChance: 0.9,  rarityWeights: { common: 30, rare: 35, epic: 25, legendary: 10 } },
  lose: { dropChance: 0.25, rarityWeights: { common: 70, rare: 25, epic: 4, legendary: 1 } },
};
