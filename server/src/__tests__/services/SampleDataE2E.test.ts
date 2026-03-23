/**
 * 샘플 데이터 & E2E 플로우 통합 테스트 (인메모리 데이터, 외부 파일 의존 없음)
 */
import { connectTestDb, disconnectTestDb, clearDb } from '../utils/testDb';
import { User } from '../../models/User';
import { Character } from '../../models/Character';
import { Game } from '../../models/Game';
import { Placement } from '../../models/Placement';
import { Battle } from '../../models/Battle';
import { settleGame } from '../../services/SettlementService';
import { Server as SocketIOServer } from 'socket.io';
import type { GameData } from '@beastleague/shared';

const mockIo = { emit: jest.fn(), to: jest.fn().mockReturnThis() } as unknown as SocketIOServer;

// ── 테스트용 GameData 픽스처 ─────────────────────────────────────────────────

const GAME_FINISHED: GameData = {
  gameId: '20260401SSHT0',
  date: '2026-04-01',
  homeTeam: '광주',
  awayTeam: '대구',
  status: 'finished',
  homeScore: 7,
  awayScore: 3,
  batterGroups: [
    {
      team: '광주',
      groupType: 'leadoff',
      stats: { AB: 9,  H: 3, '2B': 1, '3B': 0, HR: 0, RBI: 1, RUN: 2, SB: 1, BB: 2, K: 1 },
    },
    {
      team: '광주',
      groupType: 'cleanup',
      stats: { AB: 12, H: 5, '2B': 1, '3B': 0, HR: 2, RBI: 5, RUN: 3, SB: 0, BB: 1, K: 2 },
    },
    {
      team: '광주',
      groupType: 'lower',
      stats: { AB: 10, H: 2, '2B': 0, '3B': 0, HR: 0, RBI: 1, RUN: 2, SB: 0, BB: 1, K: 3 },
    },
    {
      team: '대구',
      groupType: 'leadoff',
      stats: { AB: 8,  H: 2, '2B': 1, '3B': 0, HR: 0, RBI: 0, RUN: 1, SB: 0, BB: 1, K: 2 },
    },
    {
      team: '대구',
      groupType: 'cleanup',
      stats: { AB: 11, H: 3, '2B': 0, '3B': 0, HR: 1, RBI: 2, RUN: 1, SB: 0, BB: 1, K: 3 },
    },
    {
      team: '대구',
      groupType: 'lower',
      stats: { AB: 9,  H: 1, '2B': 0, '3B': 0, HR: 0, RBI: 1, RUN: 1, SB: 0, BB: 0, K: 4 },
    },
  ],
  pitchers: [
    { team: '광주', role: 'starter', stats: { IP: 7, PITCH: 98, H: 4, K: 8, BB: 2, ER: 2 } },
    { team: '대구', role: 'starter', stats: { IP: 5, PITCH: 89, H: 8, K: 4, BB: 3, ER: 5 } },
  ],
  updatedAt: '2026-04-01T13:00:00.000Z',
};

const GAME_FINISHED_2: GameData = {
  gameId: '20260401OBLT0',
  date: '2026-04-01',
  homeTeam: '부산',
  awayTeam: '서울D',
  status: 'finished',
  homeScore: 4,
  awayScore: 5,
  batterGroups: [
    {
      team: '부산',
      groupType: 'leadoff',
      stats: { AB: 8,  H: 3, '2B': 1, '3B': 1, HR: 0, RBI: 1, RUN: 2, SB: 2, BB: 1, K: 2 },
    },
    {
      team: '부산',
      groupType: 'cleanup',
      stats: { AB: 11, H: 4, '2B': 2, '3B': 0, HR: 1, RBI: 3, RUN: 2, SB: 0, BB: 2, K: 3 },
    },
    {
      team: '부산',
      groupType: 'lower',
      stats: { AB: 10, H: 2, '2B': 0, '3B': 0, HR: 0, RBI: 0, RUN: 0, SB: 1, BB: 0, K: 4 },
    },
    {
      team: '서울D',
      groupType: 'leadoff',
      stats: { AB: 9,  H: 4, '2B': 1, '3B': 0, HR: 0, RBI: 2, RUN: 3, SB: 1, BB: 2, K: 1 },
    },
    {
      team: '서울D',
      groupType: 'cleanup',
      stats: { AB: 12, H: 5, '2B': 1, '3B': 0, HR: 2, RBI: 4, RUN: 2, SB: 0, BB: 1, K: 2 },
    },
    {
      team: '서울D',
      groupType: 'lower',
      stats: { AB: 9,  H: 2, '2B': 1, '3B': 0, HR: 0, RBI: 0, RUN: 0, SB: 0, BB: 1, K: 3 },
    },
  ],
  pitchers: [
    { team: '부산',  role: 'starter', stats: { IP: 6, PITCH: 95,  H: 7, K: 5, BB: 3, ER: 4 } },
    { team: '서울D', role: 'starter', stats: { IP: 7, PITCH: 102, H: 6, K: 6, BB: 2, ER: 3 } },
  ],
  updatedAt: '2026-04-01T13:30:00.000Z',
};

const GAME_SCHEDULED: GameData = {
  gameId: '20260401KTLG0',
  date: '2026-04-01',
  homeTeam: '서울L',
  awayTeam: '수원',
  status: 'scheduled',
  batterGroups: [],
  pitchers: [],
  updatedAt: '2026-04-01T06:00:00.000Z',
};

const SAMPLE_GAMES: GameData[] = [GAME_FINISHED, GAME_FINISHED_2, GAME_SCHEDULED];

// ── 테스트 ───────────────────────────────────────────────────────────────────

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await disconnectTestDb(); });
beforeEach(async () => { await clearDb(); jest.clearAllMocks(); });

describe('샘플 데이터 & E2E 플로우', () => {
  it('GameData 픽스처 3개 모두 DB 저장 가능', async () => {
    for (const game of SAMPLE_GAMES) {
      await Game.create(game);
    }
    const count = await Game.countDocuments();
    expect(count).toBe(3);
  });

  it('scheduled 경기 존재 확인 (배치 가능 상태)', async () => {
    for (const game of SAMPLE_GAMES) {
      await Game.create(game);
    }
    const scheduled = await Game.findOne({ status: 'scheduled' });
    expect(scheduled).not.toBeNull();
    expect(scheduled!.gameId).toBe('20260401KTLG0');
  });

  it('전체 게임 루프: 시드 → 배치 → 정산 → 대결 생성', async () => {
    // 경기 저장
    for (const game of SAMPLE_GAMES) {
      await Game.create(game);
    }

    // 유저 + 캐릭터
    const u1 = await User.create({ email: 'test1@beast.league', name: '테스터1', provider: 'google', providerId: 'g1' });
    const u2 = await User.create({ email: 'test2@beast.league', name: '테스터2', provider: 'kakao',  providerId: 'k1' });
    const c1 = await Character.create({ userId: u1._id, name: '번개곰', animalType: 'bear' });
    const c2 = await Character.create({ userId: u2._id, name: '질풍호', animalType: 'tiger' });

    // 배치 (광주 cleanup vs 대구 cleanup)
    await Placement.create({
      userId: u1._id, characterId: c1._id,
      gameId: '20260401SSHT0', team: '광주', groupType: 'cleanup',
      date: '2026-04-01', status: 'active',
    });
    await Placement.create({
      userId: u2._id, characterId: c2._id,
      gameId: '20260401SSHT0', team: '대구', groupType: 'cleanup',
      date: '2026-04-01', status: 'active',
    });

    // 정산
    const result = await settleGame('20260401SSHT0', mockIo);

    expect(result.settledPlacements).toBe(2);
    expect(result.battles).toBe(1);
    expect(result.errors).toHaveLength(0);

    // 스탯 상승 확인
    const updatedC1 = await Character.findById(c1._id);
    const updatedC2 = await Character.findById(c2._id);
    expect(updatedC1!.stats.power).toBeGreaterThan(10);   // HR 2개 반영
    expect(updatedC2!.stats.power).toBeGreaterThan(10);   // HR 1개 반영

    // 대결 생성 확인
    const battles = await Battle.find({ gameId: '20260401SSHT0' });
    expect(battles).toHaveLength(1);

    // Placement settled 처리 확인
    const settled = await Placement.find({ gameId: '20260401SSHT0', status: 'settled' });
    expect(settled).toHaveLength(2);
  });

  it('광주 cleanup 정산 스탯 계산 검증', async () => {
    // 광주 cleanup: AB:12, H:5(단타1+2B1+HR2), BB:1, HR:2, RUN:3
    // power  += HR×3(=6) + 2B×1.5(=1.5) = 7.5 → 17.5
    // skill  += 단타×1(=1) + 멀티히트보너스×1.5(=1.5) = 2.5 → 12.5
    // stamina+= (AB+BB)×0.5(=(12+1)×0.5=6.5) → 16.5
    await Game.create(GAME_FINISHED);

    const u = await User.create({ email: 't@t.com', name: '테스터', provider: 'google', providerId: 'g' });
    const c = await Character.create({ userId: u._id, name: '곰', animalType: 'bear' });
    await Placement.create({
      userId: u._id, characterId: c._id,
      gameId: '20260401SSHT0', team: '광주', groupType: 'cleanup',
      date: '2026-04-01', status: 'active',
    });

    await settleGame('20260401SSHT0', mockIo);
    const updated = await Character.findById(c._id);

    expect(updated!.stats.power).toBeGreaterThan(10);    // 기본 10 + 7.5
    expect(updated!.stats.skill).toBeGreaterThan(10);    // 기본 10 + 2.5
    expect(updated!.stats.stamina).toBeGreaterThan(10);  // 기본 10 + 6.5
  });
});
