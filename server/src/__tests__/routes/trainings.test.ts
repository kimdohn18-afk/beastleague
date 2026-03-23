import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app';
import { connectTestDb, disconnectTestDb, clearDb } from '../utils/testDb';
import { makeToken } from '../utils/testJwt';
import { User } from '../../models/User';
import { Character } from '../../models/Character';

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

describe('POST /api/trainings', () => {
  it('정상 훈련 → 200 + { character, training, levelUpResult }', async () => {
    const { token } = await createUserAndCharacter();

    const res = await request(app)
      .post('/api/trainings')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'batting' });

    expect(res.status).toBe(200);
    expect(res.body.character).toBeDefined();
    expect(res.body.training).toBeDefined();
    expect(res.body.levelUpResult).toBeDefined();
    expect(res.body.training.type).toBe('batting');
    expect(res.body.training.xpGained).toBe(10);
  });

  it('4번째 훈련 시도 → 400', async () => {
    const { token } = await createUserAndCharacter();

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/trainings')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'batting' });
    }

    const res = await request(app)
      .post('/api/trainings')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'batting' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/훈련 횟수/);
  });

  it('캐릭터 없이 훈련 → 400', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, email: 'u2@test.com', name: '없음', provider: 'kakao', providerId: 'p2' });
    const token = makeToken(String(userId));

    const res = await request(app)
      .post('/api/trainings')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'batting' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/캐릭터/);
  });
});
