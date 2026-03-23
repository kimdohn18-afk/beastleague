import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { connectTestDb, disconnectTestDb, clearDb } from '../utils/testDb';
import { User } from '../../models/User';
import { Character } from '../../models/Character';
import { Game } from '../../models/Game';
import { Placement } from '../../models/Placement';
import { Battle } from '../../models/Battle';
import { settleGame } from '../../services/SettlementService';

// Socket.IO mock
const mockIo = {
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
} as unknown as SocketIOServer;

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await disconnectTestDb(); });
beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
});

const GAME_ID = 'SETTLE001';
const GAME_DATE = '2026-04-01';

const SAMPLE_BATTER_STATS = {
  AB: 8, H: 3, '2B': 1, '3B': 0, HR: 1, RBI: 3, RUN: 2, SB: 1, BB: 2, K: 1,
};

async function createUser(n: number) {
  const userId = new mongoose.Types.ObjectId();
  await User.create({ _id: userId, email: `u${n}@test.com`, name: `유저${n}`, provider: 'kakao', providerId: `p${n}` });
  const character = await Character.create({ userId, name: `캐릭${n}`, animalType: 'bear' });
  return { userId, characterId: character._id };
}

async function createGame(status = 'finished') {
  return Game.create({
    gameId: GAME_ID,
    date: GAME_DATE,
    homeTeam: '광주',
    awayTeam: '대구',
    status,
    batterGroups: [
      { team: '광주', groupType: 'leadoff', stats: SAMPLE_BATTER_STATS },
      { team: '대구', groupType: 'leadoff', stats: SAMPLE_BATTER_STATS },
    ],
  });
}

describe('settleGame', () => {
  it('정상 정산: 배치 2명 → settledPlacements=2, battles=1', async () => {
    await createGame();
    const { userId: u1, characterId: c1 } = await createUser(1);
    const { userId: u2, characterId: c2 } = await createUser(2);

    await Placement.create({
      userId: u1, characterId: c1, gameId: GAME_ID,
      team: '광주', groupType: 'leadoff', date: GAME_DATE, status: 'active',
    });
    await Placement.create({
      userId: u2, characterId: c2, gameId: GAME_ID,
      team: '대구', groupType: 'leadoff', date: GAME_DATE, status: 'active',
    });

    const result = await settleGame(GAME_ID, mockIo);

    expect(result.settledPlacements).toBe(2);
    expect(result.battles).toBe(1);
    expect(result.errors).toHaveLength(0);

    const battles = await Battle.find({ gameId: GAME_ID });
    expect(battles).toHaveLength(1);
  });

  it('이미 정산된 경기 → throw Error', async () => {
    await createGame();
    const { userId: u1, characterId: c1 } = await createUser(1);

    // settled 상태로 미리 넣기
    await Placement.create({
      userId: u1, characterId: c1, gameId: GAME_ID,
      team: '광주', groupType: 'leadoff', date: GAME_DATE, status: 'settled',
    });

    await expect(settleGame(GAME_ID, mockIo)).rejects.toThrow('이미 정산된 경기');
  });

  it('배치 0명인 경기 → settledPlacements=0, battles=0 정상 종료', async () => {
    await createGame();
    const result = await settleGame(GAME_ID, mockIo);
    expect(result.settledPlacements).toBe(0);
    expect(result.battles).toBe(0);
  });
});
