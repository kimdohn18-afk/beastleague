/**
 * 시드 + 정산 플로우 통합 테스트 (MongoMemoryServer 사용)
 * 서버 없이 DB 레벨에서 전체 플로우 검증
 */
import mongoose from 'mongoose';
import { connectTestDb, disconnectTestDb, clearDb } from '../utils/testDb';
import { User } from '../../models/User';
import { Character } from '../../models/Character';
import { Game } from '../../models/Game';
import { Placement } from '../../models/Placement';
import { Battle } from '../../models/Battle';
import { settleGame } from '../../services/SettlementService';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';

const mockIo = { emit: jest.fn(), to: jest.fn().mockReturnThis() } as unknown as SocketIOServer;

const DATA_DIR = path.resolve(
  process.cwd().includes('server') ? process.cwd() : path.join(process.cwd(), 'server'),
  '../collector/data/2026-04-01'
);

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await disconnectTestDb(); });
beforeEach(async () => { await clearDb(); jest.clearAllMocks(); });

describe('샘플 데이터 & E2E 플로우', () => {
  it('JSON 파일 3개 모두 DB 저장 가능', async () => {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(3);

    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as Record<string, unknown>;
      await Game.create(raw);
    }
    const count = await Game.countDocuments();
    expect(count).toBe(3);
  });

  it('scheduled 경기 존재 확인 (배치 가능 상태)', async () => {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as Record<string, unknown>;
      await Game.create(raw);
    }
    const scheduled = await Game.findOne({ status: 'scheduled' });
    expect(scheduled).not.toBeNull();
    expect(scheduled!.gameId).toBe('20260401KTLG0');
  });

  it('전체 게임 루프: 시드 → 배치 → 정산 → 대결 생성', async () => {
    // 1. 경기 데이터 저장
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as Record<string, unknown>;
      await Game.create(raw);
    }

    // 2. 유저 + 캐릭터 생성
    const u1 = await User.create({ email: 'test1@beast.league', name: '테스터1', provider: 'google', providerId: 'g1' });
    const u2 = await User.create({ email: 'test2@beast.league', name: '테스터2', provider: 'kakao',  providerId: 'k1' });
    const c1 = await Character.create({ userId: u1._id, name: '번개곰', animalType: 'bear' });
    const c2 = await Character.create({ userId: u2._id, name: '질풍호', animalType: 'tiger' });

    // 3. 배치 생성 (광주 cleanup vs 대구 cleanup)
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

    // 4. 정산
    const result = await settleGame('20260401SSHT0', mockIo);

    expect(result.settledPlacements).toBe(2);
    expect(result.battles).toBe(1);
    expect(result.errors).toHaveLength(0);

    // 5. 스탯 변화 확인
    const updatedC1 = await Character.findById(c1._id);
    const updatedC2 = await Character.findById(c2._id);
    expect(updatedC1!.stats.power).toBeGreaterThan(10);   // 홈런 2개 반영
    expect(updatedC2!.stats.power).toBeGreaterThan(10);   // 홈런 1개 반영

    // 6. 대결 생성 확인
    const battles = await Battle.find({ gameId: '20260401SSHT0' });
    expect(battles).toHaveLength(1);

    // 7. Placement settled
    const settled = await Placement.find({ gameId: '20260401SSHT0', status: 'settled' });
    expect(settled).toHaveLength(2);
  });

  it('광주 cleanup 정산 스탯 계산 검증', async () => {
    // 광주 cleanup: AB:12, H:5(1루타1+2루타1+HR2), BB:1, HR:2, SB:0, RUN:3
    // 예상: power += 2*3(HR) + 1*1.5(2B) = 7.5
    //       skill += 1*1(단타) + 1.5(멀티히트 H>=2) = 2.5
    //       mind  += 1*1.5(BB) = 1.5
    //       agility += 3*1(RUN) = 3
    //       stamina += (12+1)*0.5 = 6.5
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as Record<string, unknown>;
      await Game.create(raw);
    }
    const u = await User.create({ email: 't@t.com', name: '테스터', provider: 'google', providerId: 'g' });
    const c = await Character.create({ userId: u._id, name: '곰', animalType: 'bear' });
    await Placement.create({
      userId: u._id, characterId: c._id,
      gameId: '20260401SSHT0', team: '광주', groupType: 'cleanup',
      date: '2026-04-01', status: 'active',
    });

    await settleGame('20260401SSHT0', mockIo);
    const updated = await Character.findById(c._id);

    expect(updated!.stats.power).toBeGreaterThan(10);    // +7.5 → 17.5
    expect(updated!.stats.skill).toBeGreaterThan(10);    // +2.5 → 12.5
    expect(updated!.stats.stamina).toBeGreaterThan(10);  // +6.5 → 16.5
  });
});
