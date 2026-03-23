import { validateGameData } from '../validator/GameDataValidator';
import { GameData } from '@beastleague/shared';

const validGame: GameData = {
  gameId: '20260401HTSS0',
  date: '2026-04-01',
  homeTeam: '광주',
  awayTeam: '대구',
  status: 'finished',
  homeScore: 5,
  awayScore: 3,
  batterGroups: [
    {
      team: '광주',
      groupType: 'leadoff',
      stats: { AB: 8, H: 3, '2B': 1, '3B': 0, HR: 1, RBI: 3, RUN: 2, SB: 1, BB: 2, K: 1 },
    },
  ],
  updatedAt: '2026-04-01T14:00:00.000Z',
};

describe('validateGameData', () => {
  it('정상 데이터 → valid: true', () => {
    const { valid } = validateGameData(validGame);
    expect(valid).toBe(true);
  });

  it('gameId 누락 → valid: false, 에러 메시지 포함', () => {
    const { valid, errors } = validateGameData({ ...validGame, gameId: '' });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('gameId'))).toBe(true);
  });

  it('잘못된 TeamCode → valid: false', () => {
    const { valid, errors } = validateGameData({ ...validGame, homeTeam: '부천' });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('homeTeam'))).toBe(true);
  });

  it('잘못된 status → valid: false', () => {
    const { valid, errors } = validateGameData({ ...validGame, status: 'unknown' });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('status'))).toBe(true);
  });

  it('H < 2B + 3B + HR → valid: false (단타가 음수)', () => {
    const bad = {
      ...validGame,
      batterGroups: [
        {
          team: '광주',
          groupType: 'leadoff',
          // H=1, 2B=1, HR=1 → 단타 = -1
          stats: { AB: 8, H: 1, '2B': 1, '3B': 0, HR: 1, RBI: 1, RUN: 1, SB: 0, BB: 0, K: 0 },
        },
      ],
    };
    const { valid, errors } = validateGameData(bad);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('단타'))).toBe(true);
  });

  it('batterGroups 빈 배열 → valid: false', () => {
    const { valid, errors } = validateGameData({ ...validGame, batterGroups: [] });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('batterGroups'))).toBe(true);
  });

  it('스탯값이 음수 → valid: false', () => {
    const bad = {
      ...validGame,
      batterGroups: [
        {
          team: '광주',
          groupType: 'leadoff',
          stats: { AB: -1, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, RUN: 0, SB: 0, BB: 0, K: 0 },
        },
      ],
    };
    const { valid, errors } = validateGameData(bad);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('AB'))).toBe(true);
  });

  it('date 형식 불일치 → valid: false', () => {
    const { valid, errors } = validateGameData({ ...validGame, date: '20260401' });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('date'))).toBe(true);
  });

  it('잘못된 groupType → valid: false', () => {
    const bad = {
      ...validGame,
      batterGroups: [
        { team: '광주', groupType: 'unknown', stats: validGame.batterGroups[0].stats },
      ],
    };
    const { valid, errors } = validateGameData(bad);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('groupType'))).toBe(true);
  });
});
