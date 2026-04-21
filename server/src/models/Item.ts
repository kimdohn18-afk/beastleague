import { Schema, model, Document, Types } from 'mongoose';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemSlot = 'bat' | 'glove' | 'shoes' | 'helmet' | 'accessory';

export interface IItemEffect {
  stat?: string;          // power, agility, skill, stamina, mind
  value: number;          // 보너스 수치
  xpBonus?: number;       // XP 획득량 보너스 (%)
}

export interface IItem extends Document {
  templateId: string;       // 아이템 종류 식별자
  name: string;
  description: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  baseEffect: IItemEffect;
  icon: string;             // 이모지
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

// ── 아이템 템플릿 (시드용) ──

export const ITEM_TEMPLATES = [
  // 배트 (파워)
  { templateId: 'bat_wood',     name: '나무 배트',     slot: 'bat',    rarity: 'common',    icon: '🏏', description: '기본 나무 배트',           baseEffect: { stat: 'power', value: 1 } },
  { templateId: 'bat_aluminum', name: '알루미늄 배트', slot: 'bat',    rarity: 'rare',      icon: '⚾', description: '가벼운 알루미늄 배트',     baseEffect: { stat: 'power', value: 3 } },
  { templateId: 'bat_carbon',   name: '카본 배트',     slot: 'bat',    rarity: 'epic',      icon: '🔥', description: '고탄성 카본 배트',         baseEffect: { stat: 'power', value: 5 } },
  { templateId: 'bat_legend',   name: '전설의 배트',   slot: 'bat',    rarity: 'legendary', icon: '⚡', description: '전설적인 힘이 깃든 배트',   baseEffect: { stat: 'power', value: 8, xpBonus: 5 } },

  // 글러브 (기술)
  { templateId: 'glove_leather',  name: '가죽 글러브',   slot: 'glove', rarity: 'common',    icon: '🧤', description: '기본 가죽 글러브',         baseEffect: { stat: 'skill', value: 1 } },
  { templateId: 'glove_pro',     name: '프로 글러브',   slot: 'glove', rarity: 'rare',      icon: '🥊', description: '프로용 글러브',             baseEffect: { stat: 'skill', value: 3 } },
  { templateId: 'glove_golden',  name: '골든 글러브',   slot: 'glove', rarity: 'epic',      icon: '✨', description: '골드글러브 수상작',         baseEffect: { stat: 'skill', value: 5 } },
  { templateId: 'glove_legend',  name: '전설의 글러브', slot: 'glove', rarity: 'legendary', icon: '👑', description: '잡히지 않는 공이 없다',     baseEffect: { stat: 'skill', value: 8, xpBonus: 5 } },

  // 신발 (민첩)
  { templateId: 'shoes_basic',   name: '운동화',       slot: 'shoes',  rarity: 'common',    icon: '👟', description: '기본 운동화',               baseEffect: { stat: 'agility', value: 1 } },
  { templateId: 'shoes_spike',   name: '스파이크',     slot: 'shoes',  rarity: 'rare',      icon: '👞', description: '접지력 좋은 스파이크',       baseEffect: { stat: 'agility', value: 3 } },
  { templateId: 'shoes_wind',    name: '질풍의 신발',  slot: 'shoes',  rarity: 'epic',      icon: '💨', description: '바람을 가르는 스피드',       baseEffect: { stat: 'agility', value: 5 } },
  { templateId: 'shoes_legend',  name: '전설의 신발',  slot: 'shoes',  rarity: 'legendary', icon: '🌪️', description: '빛보다 빠른 발걸음',         baseEffect: { stat: 'agility', value: 8, xpBonus: 5 } },

  // 헬멧 (체력)
  { templateId: 'helmet_basic',  name: '기본 헬멧',    slot: 'helmet', rarity: 'common',    icon: '⛑️', description: '기본 보호 헬멧',            baseEffect: { stat: 'stamina', value: 1 } },
  { templateId: 'helmet_pro',    name: '프로 헬멧',    slot: 'helmet', rarity: 'rare',      icon: '🪖', description: '프로용 경량 헬멧',           baseEffect: { stat: 'stamina', value: 3 } },
  { templateId: 'helmet_iron',   name: '강철 헬멧',    slot: 'helmet', rarity: 'epic',      icon: '🛡️', description: '무적의 방어력',              baseEffect: { stat: 'stamina', value: 5 } },
  { templateId: 'helmet_legend', name: '전설의 헬멧',  slot: 'helmet', rarity: 'legendary', icon: '💎', description: '전설의 보호막',              baseEffect: { stat: 'stamina', value: 8, xpBonus: 5 } },

  // 악세서리 (정신)
  { templateId: 'acc_band',     name: '손목밴드',     slot: 'accessory', rarity: 'common',    icon: '🔗', description: '집중력을 높이는 밴드',     baseEffect: { stat: 'mind', value: 1 } },
  { templateId: 'acc_chain',    name: '행운의 목걸이', slot: 'accessory', rarity: 'rare',      icon: '📿', description: '행운을 부르는 목걸이',     baseEffect: { stat: 'mind', value: 3 } },
  { templateId: 'acc_ring',     name: '챔피언 반지',  slot: 'accessory', rarity: 'epic',      icon: '💍', description: '챔피언의 정신력',           baseEffect: { stat: 'mind', value: 5 } },
  { templateId: 'acc_legend',   name: '전설의 부적',  slot: 'accessory', rarity: 'legendary', icon: '🏅', description: '전설의 집중력',             baseEffect: { stat: 'mind', value: 8, xpBonus: 5 } },
];

// 등급별 드롭 확률
export const DROP_RATES: Record<string, { dropChance: number; rarityWeights: Record<ItemRarity, number> }> = {
  win: {
    dropChance: 0.7,  // 승리 시 70% 확률로 아이템
    rarityWeights: { common: 50, rare: 30, epic: 15, legendary: 5 },
  },
  mvp: {
    dropChance: 0.9,  // MVP 시 90%
    rarityWeights: { common: 30, rare: 35, epic: 25, legendary: 10 },
  },
  lose: {
    dropChance: 0.25, // 패배 시 25%
    rarityWeights: { common: 70, rare: 25, epic: 4, legendary: 1 },
  },
};
import { Schema, model, Document, Types } from 'mongoose';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemSlot = 'bat' | 'glove' | 'shoes' | 'helmet' | 'accessory';

export interface IItemEffect {
  stat?: string;          // power, agility, skill, stamina, mind
  value: number;          // 보너스 수치
  xpBonus?: number;       // XP 획득량 보너스 (%)
}

export interface IItem extends Document {
  templateId: string;       // 아이템 종류 식별자
  name: string;
  description: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  baseEffect: IItemEffect;
  icon: string;             // 이모지
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

// ── 아이템 템플릿 (시드용) ──

export const ITEM_TEMPLATES = [
  // 배트 (파워)
  { templateId: 'bat_wood',     name: '나무 배트',     slot: 'bat',    rarity: 'common',    icon: '🏏', description: '기본 나무 배트',           baseEffect: { stat: 'power', value: 1 } },
  { templateId: 'bat_aluminum', name: '알루미늄 배트', slot: 'bat',    rarity: 'rare',      icon: '⚾', description: '가벼운 알루미늄 배트',     baseEffect: { stat: 'power', value: 3 } },
  { templateId: 'bat_carbon',   name: '카본 배트',     slot: 'bat',    rarity: 'epic',      icon: '🔥', description: '고탄성 카본 배트',         baseEffect: { stat: 'power', value: 5 } },
  { templateId: 'bat_legend',   name: '전설의 배트',   slot: 'bat',    rarity: 'legendary', icon: '⚡', description: '전설적인 힘이 깃든 배트',   baseEffect: { stat: 'power', value: 8, xpBonus: 5 } },

  // 글러브 (기술)
  { templateId: 'glove_leather',  name: '가죽 글러브',   slot: 'glove', rarity: 'common',    icon: '🧤', description: '기본 가죽 글러브',         baseEffect: { stat: 'skill', value: 1 } },
  { templateId: 'glove_pro',     name: '프로 글러브',   slot: 'glove', rarity: 'rare',      icon: '🥊', description: '프로용 글러브',             baseEffect: { stat: 'skill', value: 3 } },
  { templateId: 'glove_golden',  name: '골든 글러브',   slot: 'glove', rarity: 'epic',      icon: '✨', description: '골드글러브 수상작',         baseEffect: { stat: 'skill', value: 5 } },
  { templateId: 'glove_legend',  name: '전설의 글러브', slot: 'glove', rarity: 'legendary', icon: '👑', description: '잡히지 않는 공이 없다',     baseEffect: { stat: 'skill', value: 8, xpBonus: 5 } },

  // 신발 (민첩)
  { templateId: 'shoes_basic',   name: '운동화',       slot: 'shoes',  rarity: 'common',    icon: '👟', description: '기본 운동화',               baseEffect: { stat: 'agility', value: 1 } },
  { templateId: 'shoes_spike',   name: '스파이크',     slot: 'shoes',  rarity: 'rare',      icon: '👞', description: '접지력 좋은 스파이크',       baseEffect: { stat: 'agility', value: 3 } },
  { templateId: 'shoes_wind',    name: '질풍의 신발',  slot: 'shoes',  rarity: 'epic',      icon: '💨', description: '바람을 가르는 스피드',       baseEffect: { stat: 'agility', value: 5 } },
  { templateId: 'shoes_legend',  name: '전설의 신발',  slot: 'shoes',  rarity: 'legendary', icon: '🌪️', description: '빛보다 빠른 발걸음',         baseEffect: { stat: 'agility', value: 8, xpBonus: 5 } },

  // 헬멧 (체력)
  { templateId: 'helmet_basic',  name: '기본 헬멧',    slot: 'helmet', rarity: 'common',    icon: '⛑️', description: '기본 보호 헬멧',            baseEffect: { stat: 'stamina', value: 1 } },
  { templateId: 'helmet_pro',    name: '프로 헬멧',    slot: 'helmet', rarity: 'rare',      icon: '🪖', description: '프로용 경량 헬멧',           baseEffect: { stat: 'stamina', value: 3 } },
  { templateId: 'helmet_iron',   name: '강철 헬멧',    slot: 'helmet', rarity: 'epic',      icon: '🛡️', description: '무적의 방어력',              baseEffect: { stat: 'stamina', value: 5 } },
  { templateId: 'helmet_legend', name: '전설의 헬멧',  slot: 'helmet', rarity: 'legendary', icon: '💎', description: '전설의 보호막',              baseEffect: { stat: 'stamina', value: 8, xpBonus: 5 } },

  // 악세서리 (정신)
  { templateId: 'acc_band',     name: '손목밴드',     slot: 'accessory', rarity: 'common',    icon: '🔗', description: '집중력을 높이는 밴드',     baseEffect: { stat: 'mind', value: 1 } },
  { templateId: 'acc_chain',    name: '행운의 목걸이', slot: 'accessory', rarity: 'rare',      icon: '📿', description: '행운을 부르는 목걸이',     baseEffect: { stat: 'mind', value: 3 } },
  { templateId: 'acc_ring',     name: '챔피언 반지',  slot: 'accessory', rarity: 'epic',      icon: '💍', description: '챔피언의 정신력',           baseEffect: { stat: 'mind', value: 5 } },
  { templateId: 'acc_legend',   name: '전설의 부적',  slot: 'accessory', rarity: 'legendary', icon: '🏅', description: '전설의 집중력',             baseEffect: { stat: 'mind', value: 8, xpBonus: 5 } },
];

// 등급별 드롭 확률
export const DROP_RATES: Record<string, { dropChance: number; rarityWeights: Record<ItemRarity, number> }> = {
  win: {
    dropChance: 0.7,  // 승리 시 70% 확률로 아이템
    rarityWeights: { common: 50, rare: 30, epic: 15, legendary: 5 },
  },
  mvp: {
    dropChance: 0.9,  // MVP 시 90%
    rarityWeights: { common: 30, rare: 35, epic: 25, legendary: 10 },
  },
  lose: {
    dropChance: 0.25, // 패배 시 25%
    rarityWeights: { common: 70, rare: 25, epic: 4, legendary: 1 },
  },
};
