import { executeBattle } from '../BattleEngine';

describe('executeBattle', () => {
  it('player1=10, player2=5 → player1 win, player2 lose', () => {
    const r = executeBattle(10, 5);
    expect(r.result.player1).toBe('win');
    expect(r.result.player2).toBe('lose');
    expect(r.xpAwarded.player1).toBe(25);
    expect(r.xpAwarded.player2).toBe(5);
  });

  it('player1=10, player2=9.5 → draw (10% 이내 차이)', () => {
    // diff = 0.5/10 = 0.05 ≤ 0.1
    const r = executeBattle(10, 9.5);
    expect(r.result.player1).toBe('draw');
    expect(r.result.player2).toBe('draw');
    expect(r.xpAwarded.player1).toBe(15);
    expect(r.xpAwarded.player2).toBe(15);
  });

  it('player1=0, player2=0 → draw, XP 5', () => {
    const r = executeBattle(0, 0);
    expect(r.result.player1).toBe('draw');
    expect(r.result.player2).toBe('draw');
    expect(r.xpAwarded.player1).toBe(5);
    expect(r.xpAwarded.player2).toBe(5);
  });

  it('player2가 높으면 player2 win', () => {
    const r = executeBattle(3, 8);
    expect(r.result.player1).toBe('lose');
    expect(r.result.player2).toBe('win');
    expect(r.xpAwarded.player1).toBe(5);
    expect(r.xpAwarded.player2).toBe(25);
  });

  it('정확히 10% 차이 → draw 경계', () => {
    // diff = 1/10 = 0.1 (exactly DRAW_THRESHOLD)
    const r = executeBattle(10, 9);
    expect(r.result.player1).toBe('draw');
  });

  it('10% 초과 → win/lose', () => {
    // diff = 1.1/10 = 0.11 > 0.1
    const r = executeBattle(10, 8.9);
    expect(r.result.player1).toBe('win');
    expect(r.result.player2).toBe('lose');
  });
});
