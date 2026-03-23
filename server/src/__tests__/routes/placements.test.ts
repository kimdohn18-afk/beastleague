import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app';
import { connectTestDb, disconnectTestDb, clearDb } from '../utils/testDb';
import { makeToken } from '../utils/testJwt';
import { User } from '../../models/User';
import { Character } from '../../models/Character';
import { Game } from '../../models/Game';

const app = createApp();

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await disconnectTestDb(); });
beforeEach(async () => { await clearDb(); });

async function createUserAndCharacter() {
  const userId = new mongoose.Types.ObjectId();
  await User.create({ _id: userId, email: 'u@test.com', name: '테스트', provider: 'kakao', providerId: 'p1' });
  const character = await Character.create({ userId, name: '테스트캐릭', animalType: 'bear' });
  const token = makeToken(String(userId));
  return { userId, character, token };
}

async function createScheduledGame() {
  return Game.create({
    gameId: 'TEST001',
    date: '2099-01-01',
    homeTeam: '광주',
    awayTeam: '대구',
    status: 'scheduled',
    batterGroups: [],
  });
}

describe('POST /api/placements', () => {
  it('캐릭터 없이 배치 시도 → 400', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, email: 'u2@test.com', name: '없음', provider: 'kakao', providerId: 'p2' });
    const token = makeToken(String(userId));

    await createScheduledGame();
    const res = await request(app)
      .post('/api/placements')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId: 'TEST001', team: '광주', groupType: 'leadoff' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/캐릭터/);
  });

  it('정상 배치 → 201 + placement 반환', async () => {
    const { token } = await createUserAndCharacter();
    await createScheduledGame();

    const res = await request(app)
      .post('/api/placements')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId: 'TEST001', team: '광주', groupType: 'leadoff' });

    expect(res.status).toBe(201);
    expect(res.body.gameId).toBe('TEST001');
    expect(res.body.team).toBe('광주');
  });

  it('같은 날 중복 배치 → 409', async () => {
    const { token } = await createUserAndCharacter();
    await createScheduledGame();

    await request(app)
      .post('/api/placements')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId: 'TEST001', team: '광주', groupType: 'leadoff' });

    const res = await request(app)
      .post('/api/placements')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId: 'TEST001', team: '광주', groupType: 'cleanup' });

    expect(res.status).toBe(409);
  });

  it('존재하지 않는 gameId → 400', async () => {
    const { token } = await createUserAndCharacter();

    const res = await request(app)
      .post('/api/placements')
      .set('Authorization', `Bearer ${token}`)
      .send({ gameId: 'NONEXIST', team: '광주', groupType: 'leadoff' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/존재하지 않는/);
  });
});
