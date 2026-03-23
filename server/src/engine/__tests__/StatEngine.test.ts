import { calculateStatGains, applyStatGains, calculateXpFromGains } from '../StatEngine';
import { BatterGroupStats, PitcherStats, CharacterStats } from '@beastleague/shared';

const emptyBatter = (): BatterGroupStats => ({
  AB: 0, H: 0, '2B': 0, '3B': 0, HR: 0,
  RBI: 0, RUN: 0, SB: 0, BB: 0, K: 0,
});

const baseStats = (): CharacterStats => ({
  power: 50, agility: 50, skill: 50, stamina: 50, mind: 50,
});

describe('calculateStatGains', () => {
  it('홈런 3개 → Power +9', () => {
    const g = calculateStatGains({ ...emptyBatter(), HR: 3, AB: 3 });
    expect(g.power).toBe(9);
  });

  it('볼넷 2, 삼진 1 → Mind +2.5 (1.5×2 + (-0.5)×1)', () => {
    const g = calculateStatGains({ ...emptyBatter(), BB: 2, K: 1, AB: 3 });
    expect(g.mind).toBeCloseTo(2.5, 2);
  });

  it('단타 계산: H=3, 2B=1, 3B=0, HR=1 → 단타 1 → Skill +1', () => {
    // 단타 = 3 - 1 - 0 - 1 = 1
    const g = calculateStatGains({ ...emptyBatter(), H: 3, '2B': 1, HR: 1, AB: 4 });
    // H=3 >= 2 이므로 MULTI_HIT +1.5 도 포함
    expect(g.skill).toBeCloseTo(1 + 1.5, 2); // single 1×1 + multi_hit 1.5
  });

  it('H >= 2일 때 MULTI_HIT 보너스 +1.5', () => {
    const g1 = calculateStatGains({ ...emptyBatter(), H: 2, AB: 2 });
    const g2 = calculateStatGains({ ...emptyBatter(), H: 1, AB: 1 });
    // H=2: 단타 2 × 1 + multi 1.5 = 3.5
    expect(g1.skill).toBeCloseTo(3.5, 2);
    // H=1: 단타 1 × 1, no multi
    expect(g2.skill).toBeCloseTo(1, 2);
  });

  it('빈 스탯(전부 0) → 모든 gains가 0 또는 undefined', () => {
    const g = calculateStatGains(emptyBatter());
    const vals = Object.values(g);
    vals.forEach((v) => expect(v).toBe(0));
  });

  it('투수 IP 적용: IP=6 → Stamina +6', () => {
    const pitcher: PitcherStats = { IP: 6, PITCH: 90, H: 5, K: 5, BB: 2, ER: 2 };
    const g = calculateStatGains(emptyBatter(), pitcher);
    expect(g.stamina).toBeCloseTo(6, 2);
  });
});

describe('applyStatGains', () => {
  it('clamp: current power=99, gains power=3 → 100', () => {
    const result = applyStatGains({ ...baseStats(), power: 99 }, { power: 3 });
    expect(result.power).toBe(100);
  });

  it('clamp: current mind=2, gains mind=-5 → 1', () => {
    const result = applyStatGains({ ...baseStats(), mind: 2 }, { mind: -5 });
    expect(result.mind).toBe(1);
  });

  it('정상 적용: power=50, gains power=5 → 55', () => {
    const result = applyStatGains(baseStats(), { power: 5 });
    expect(result.power).toBe(55);
  });
});

describe('calculateXpFromGains', () => {
  it('gains {power:3, agility:1, mind:-0.5} → (3+1+0.5)×10 = 45', () => {
    const xp = calculateXpFromGains({ power: 3, agility: 1, mind: -0.5 });
    expect(xp).toBe(45);
  });

  it('빈 gains → XP 0', () => {
    expect(calculateXpFromGains({})).toBe(0);
  });
});
