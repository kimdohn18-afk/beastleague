import { InventoryItem } from '../models/Inventory';
import { IMatchResult, IMatchPersonalStats, IStatGain } from '../models/VirtualMatch';
import { ITEM_TEMPLATES, DROP_RATES, ItemRarity } from '../models/Item';

interface Stats {
  power: number;
  agility: number;
  skill: number;
  stamina: number;
  mind: number;
}

// 장착 아이템 보너스 계산
export async function getEquippedBonus(userId: string): Promise<Partial<Stats>> {
  const equipped = await InventoryItem.find({ userId, equipped: true }).lean();
  const bonus: Record<string, number> = { power: 0, agility: 0, skill: 0, stamina: 0, mind: 0 };
  for (const item of equipped) {
    if (item.currentEffect?.stat && bonus[item.currentEffect.stat] !== undefined) {
      bonus[item.currentEffect.stat] += item.currentEffect.value || 0;
    }
  }
  return bonus as Partial<Stats>;
}

// 메인 시뮬레이션
export function simulateMatch(baseStats: Stats, equipBonus: Partial<Stats>): IMatchResult {
  const s = {
    power:   (baseStats.power || 1) + (equipBonus.power || 0),
    agility: (baseStats.agility || 1) + (equipBonus.agility || 0),
    skill:   (baseStats.skill || 1) + (equipBonus.skill || 0),
    stamina: (baseStats.stamina || 1) + (equipBonus.stamina || 0),
    mind:    (baseStats.mind || 1) + (equipBonus.mind || 0),
  };

  const atBats = 4;
  let hits = 0;
  let doubles = 0;
  let homeRuns = 0;
  let walks = 0;
  let stolenBases = 0;
  let runs = 0;
  let errors = 0;

  // ── 타석별 시뮬레이션 ──
  const walkChance = Math.min(0.04 + s.mind * 0.0022, 0.25);
  const hitChance = Math.min(0.12 + s.skill * 0.0023, 0.55);
  const hrChance = Math.min(0.03 + s.power * 0.0015, 0.35);
  const doubleChance = Math.min(0.05 + s.power * 0.001, 0.20);

  for (let i = 0; i < atBats; i++) {
    // 볼넷 먼저
    if (Math.random() < walkChance) {
      walks++;
      continue;
    }
    // 안타 판정
    if (Math.random() < hitChance) {
      hits++;
      // 홈런?
      if (Math.random() < hrChance) {
        homeRuns++;
        runs++; // 홈런 = 자동 득점
      } else if (Math.random() < doubleChance) {
        doubles++;
      }
    }
  }

  // ── 도루 ──
  const stolenAttempts = s.agility >= 8 ? 2 : 1;
  const stolenSuccessRate = Math.min(0.25 + s.agility * 0.003, 0.85);
  for (let i = 0; i < stolenAttempts; i++) {
    if (Math.random() < stolenSuccessRate) stolenBases++;
  }

  // ── 추가 득점 (출루 기반) ──
  const onBase = hits - homeRuns + walks; // 홈런 제외 출루
  const runChance = Math.min(0.2 + s.agility * 0.006, 0.5);
  for (let i = 0; i < onBase; i++) {
    if (Math.random() < runChance) runs++;
  }

  // ── 수비 (실책) ──
  const errorChance = Math.max(0.45 - s.stamina * 0.025, 0.03);
  if (Math.random() < errorChance) errors = 1;
  if (errors > 0 && Math.random() < errorChance * 0.5) errors = 2;

  // ── 팀 스코어 ──
  const totalStats = s.power + s.agility + s.skill + s.stamina + s.mind;
  const winBoost = Math.min(totalStats * 0.001, 0.05); // 최대 +5%
  const baseWinRate = 0.47 + winBoost;

  // 내 팀 득점 (내 기여 + 팀 랜덤)
  const teamBaseRuns = Math.round(2 + Math.random() * 3); // 2~5
  const myScore = Math.max(teamBaseRuns + runs, runs);

  // 상대 팀 득점
  const defenseRating = (s.stamina + s.mind) * 0.003;
  const oppBaseRuns = Math.round(2 + Math.random() * 4 - defenseRating + errors * 0.5);
  const oppScore = Math.max(0, oppBaseRuns);

  // 승패 결정
  let win: boolean;
  if (myScore !== oppScore) {
    win = myScore > oppScore;
  } else {
    // 동점이면 확률로 결정
    win = Math.random() < baseWinRate;
  }

  // 최종 스코어 보정 (동점 방지)
  let finalMyScore = myScore;
  let finalOppScore = oppScore;
  if (finalMyScore === finalOppScore) {
    if (win) finalMyScore++;
    else finalOppScore++;
  }
  if (win && finalMyScore <= finalOppScore) {
    finalMyScore = finalOppScore + 1;
  }
  if (!win && finalMyScore >= finalOppScore) {
    finalOppScore = finalMyScore + 1;
  }

  // ── MVP 판정 ──
  const mvpScore = hits * 2 + homeRuns * 5 + doubles * 1 + stolenBases * 2 + walks * 1 + (errors === 0 ? 2 : 0) + s.mind * 0.03;
  const mvp = mvpScore >= 4;

  const personal: IMatchPersonalStats = {
    atBats,
    hits,
    doubles,
    homeRuns,
    walks,
    stolenBases,
    runs,
    errors,
    mvp,
  };

  return {
    myScore: finalMyScore,
    oppScore: finalOppScore,
    win,
    personal,
  };
}

// 스탯 상승 계산 (조건 충족 시 100%)
export function calculateStatGain(personal: IMatchPersonalStats): IStatGain {
  const gain: IStatGain = { power: 0, skill: 0, agility: 0, stamina: 0, mind: 0 };

  if (personal.hits >= 1) gain.skill = 1;
  if (personal.doubles >= 1 || personal.homeRuns >= 1) gain.power = 1;
  if (personal.hits + personal.walks >= 2) gain.agility = 1; // 출루 2회 이상
  if (personal.errors === 0) gain.stamina = 1;
  if (personal.walks >= 1) gain.mind = 1;

  // MVP 보너스: 올스탯 +1
  if (personal.mvp) {
    gain.power += 1;
    gain.skill += 1;
    gain.agility += 1;
    gain.stamina += 1;
    gain.mind += 1;
  }

  return gain;
}

// XP 보상 계산 (4시간 기준)
export function calculateMatchXp(result: IMatchResult): number {
  let xp = 8; // 기본 참가
  xp += result.personal.hits * 2;
  xp += result.personal.homeRuns * 5;
  xp += result.personal.doubles * 1;
  xp += result.personal.stolenBases * 3;
  xp += result.personal.walks * 1;
  if (result.personal.errors === 0) xp += 3;
  if (result.win) xp += 5;
  if (result.personal.mvp) xp += 8;
  return xp;
}

// 아이템 드롭
export function rollItemDrop(result: IMatchResult): { dropped: boolean; templateId: string | null } {
  // 개인 성적 등급 판정
  let tier: string;
  if (result.personal.mvp) tier = 'mvp';
  else if (result.personal.hits >= 3 || result.personal.homeRuns >= 2) tier = 'mvp';
  else if (result.personal.hits >= 2) tier = 'win';
  else if (result.personal.hits >= 1) tier = 'win';
  else tier = 'lose';

  // 시간 보정 (4시간 = ×1.0 기준)
  const rates = DROP_RATES[tier];
  if (!rates) return { dropped: false, templateId: null };

  if (Math.random() > rates.dropChance) {
    return { dropped: false, templateId: null };
  }

  const roll = Math.random() * 100;
  let cumulative = 0;
  let selectedRarity: ItemRarity = 'common';
  for (const [rarity, weight] of Object.entries(rates.rarityWeights)) {
    cumulative += weight;
    if (roll <= cumulative) {
      selectedRarity = rarity as ItemRarity;
      break;
    }
  }

  const candidates = ITEM_TEMPLATES.filter(t => t.rarity === selectedRarity);
  if (candidates.length === 0) return { dropped: false, templateId: null };
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return { dropped: true, templateId: chosen.templateId };
}
