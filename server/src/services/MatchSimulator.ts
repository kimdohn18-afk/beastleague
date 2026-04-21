import { IStats } from '../models/Character';
import { IVirtualMatchResult } from '../models/VirtualMatch';
import { ITEM_TEMPLATES, DROP_RATES, ItemRarity } from '../models/Item';
import { InventoryItem } from '../models/Inventory';

// 장착 아이템 보너스 계산
export async function getEquippedBonus(userId: string): Promise<Partial<IStats>> {
  const equipped = await InventoryItem.find({ userId, equipped: true }).lean();
  const bonus: Record<string, number> = { power: 0, agility: 0, skill: 0, stamina: 0, mind: 0 };

  for (const item of equipped) {
    if (item.currentEffect?.stat && bonus[item.currentEffect.stat] !== undefined) {
      bonus[item.currentEffect.stat] += item.currentEffect.value || 0;
    }
  }

  return bonus as Partial<IStats>;
}

// 시뮬레이션 실행
export function simulateMatch(stats: IStats, equipBonus: Partial<IStats>): IVirtualMatchResult {
  const s = {
    power:   (stats.power || 1) + (equipBonus.power || 0),
    agility: (stats.agility || 1) + (equipBonus.agility || 0),
    skill:   (stats.skill || 1) + (equipBonus.skill || 0),
    stamina: (stats.stamina || 1) + (equipBonus.stamina || 0),
    mind:    (stats.mind || 1) + (equipBonus.mind || 0),
  };

  const totalPower = s.power + s.agility + s.skill + s.stamina + s.mind;

  // 타격 (power + skill 기반)
  const hitChance = Math.min(0.15 + (s.power + s.skill) * 0.008, 0.55);
  const atBats = 4;
  let hits = 0;
  let homeRuns = 0;

  for (let i = 0; i < atBats; i++) {
    if (Math.random() < hitChance) {
      hits++;
      // 홈런 확률 (power 기반)
      if (Math.random() < Math.min(0.03 + s.power * 0.005, 0.2)) {
        homeRuns++;
      }
    }
  }

  // 득점 (agility + 안타 기반)
  const runChance = Math.min(0.2 + s.agility * 0.006, 0.5);
  let myRuns = homeRuns; // 홈런은 자동 득점
  for (let i = 0; i < hits - homeRuns; i++) {
    if (Math.random() < runChance) myRuns++;
  }
  // 추가 득점 기회
  if (Math.random() < 0.3) myRuns += Math.random() < runChance ? 1 : 0;

  // 상대 득점 (stamina + mind로 억제)
  const defenseRating = (s.stamina + s.mind) * 0.005;
  const baseOppRuns = 2 + Math.random() * 4; // 2~6점
  const oppRuns = Math.max(0, Math.round(baseOppRuns - defenseRating * 3 + (Math.random() - 0.5) * 2));

  const win = myRuns > oppRuns;

  // MVP: 승리 + 3안타 이상 또는 홈런 2개 이상
  const mvp = win && (hits >= 3 || homeRuns >= 2);

  return {
    myHits: hits,
    myHomeRuns: homeRuns,
    myRuns,
    oppRuns,
    mvp,
    win,
  };
}

// 아이템 드롭 결정
export function rollItemDrop(result: IVirtualMatchResult): { dropped: boolean; templateId: string | null } {
  const tier = result.mvp ? 'mvp' : result.win ? 'win' : 'lose';
  const rates = DROP_RATES[tier];

  if (Math.random() > rates.dropChance) {
    return { dropped: false, templateId: null };
  }

  // 등급 결정
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

  // 해당 등급 아이템 중 랜덤
  const candidates = ITEM_TEMPLATES.filter(t => t.rarity === selectedRarity);
  if (candidates.length === 0) return { dropped: false, templateId: null };

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return { dropped: true, templateId: chosen.templateId };
}

// XP 보상 계산
export function calculateMatchXp(result: IVirtualMatchResult): number {
  let xp = 5; // 기본 참가 보상
  if (result.win) xp += 10;
  if (result.mvp) xp += 10;
  xp += result.myHits * 2;
  xp += result.myHomeRuns * 5;
  return xp;
}
