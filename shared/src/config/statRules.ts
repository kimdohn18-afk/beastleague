import { StatType } from '../types/Character';

export interface StatRule {
  event: string;
  effects: Partial<Record<StatType, number>>;
  description: string;
}

export const STAT_RULES: StatRule[] = [
  { event: 'HR',        effects: { power: 3 },              description: '홈런' },
  { event: '3B',        effects: { power: 2, agility: 1 },  description: '3루타' },
  { event: '2B',        effects: { power: 1.5 },             description: '2루타' },
  { event: 'H',         effects: { skill: 1 },               description: '안타' },
  { event: 'MULTI_HIT', effects: { skill: 1.5 },             description: '멀티히트 보너스 (2안타 이상)' },
  { event: 'SB',        effects: { agility: 2.5 },           description: '도루' },
  { event: 'RUN',       effects: { agility: 1 },             description: '득점' },
  { event: 'BB',        effects: { mind: 1.5 },              description: '볼넷' },
  { event: 'K',         effects: { mind: -0.5 },             description: '삼진' },
  { event: 'PA',        effects: { stamina: 0.5 },           description: '타석 출전' },
  { event: 'IP',        effects: { stamina: 1 },             description: '투구 이닝 (이닝당)' },
];

export const STAT_RULE_MAP = Object.fromEntries(
  STAT_RULES.map((r) => [r.event, r])
) as Record<string, StatRule>;
