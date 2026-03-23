/**
 * 로컬 테스트용 시드 스크립트
 * 실행: npx ts-node server/src/scripts/seed.ts
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Character } from '../models/Character';
import { Game } from '../models/Game';
import { Placement } from '../models/Placement';
import { StatLog } from '../models/StatLog';
import { Battle } from '../models/Battle';
import { Training } from '../models/Training';
import { sanitizeGameData } from '../validator/GameDataValidator';
import { GameData } from '@beastleague/shared';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/beastleague';
const DATA_DIR = path.resolve(__dirname, '../../../collector/data/2026-04-01');

const log = (msg: string) => console.log(msg);
const ok  = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string) => console.log(`  ❌ ${msg}`);

async function clearAll() {
  log('\n🗑️  기존 데이터 삭제...');
  await Promise.all([
    User.deleteMany({}),
    Character.deleteMany({}),
    Game.deleteMany({}),
    Placement.deleteMany({}),
    StatLog.deleteMany({}),
    Battle.deleteMany({}),
    Training.deleteMany({}),
  ]);
  ok('전체 컬렉션 초기화 완료');
}

async function seedUsers() {
  log('\n👤 유저 생성...');
  const users = await User.insertMany([
    { email: 'test1@beast.league', name: '테스터1', provider: 'google',  providerId: 'g-test-001' },
    { email: 'test2@beast.league', name: '테스터2', provider: 'kakao',   providerId: 'k-test-002' },
    { email: 'test3@beast.league', name: '테스터3', provider: 'google',  providerId: 'g-test-003' },
  ]);
  users.forEach((u) => ok(`${u.name} (${u.email})`));
  return users;
}

async function seedCharacters(users: mongoose.Document[]) {
  log('\n🐾 캐릭터 생성...');
  const defs = [
    { name: '번개곰', animalType: 'bear'  },
    { name: '질풍호', animalType: 'tiger' },
    { name: '하늘매', animalType: 'eagle' },
  ];
  const characters = [];
  for (let i = 0; i < users.length; i++) {
    const c = await Character.create({ userId: users[i]._id, ...defs[i] });
    ok(`${defs[i].name} (${defs[i].animalType})`);
    characters.push(c);
  }
  return characters;
}

async function seedGames() {
  log('\n⚾ 경기 데이터 로드...');
  if (!fs.existsSync(DATA_DIR)) {
    fail(`디렉토리 없음: ${DATA_DIR}`);
    return [];
  }
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  const games = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')) as unknown;
      const game = sanitizeGameData(raw);
      if (!game) { fail(`검증 실패: ${file}`); continue; }
      await Game.findOneAndUpdate({ gameId: game.gameId }, { $set: game }, { upsert: true, new: true });
      ok(`${game.gameId} (${game.homeTeam} vs ${game.awayTeam} — ${game.status})`);
      games.push(game);
    } catch (e) {
      fail(`${file}: ${String(e)}`);
    }
  }
  return games;
}

async function seedPlacements(
  users: mongoose.Document[],
  characters: mongoose.Document[],
  games: GameData[]
) {
  log('\n📍 배치 생성...');
  const date = '2026-04-01';

  const placements: Array<{ userIdx: number; gameId: string; team: string; groupType: string }> = [
    { userIdx: 0, gameId: '20260401SSHT0', team: '광주', groupType: 'cleanup' },
    { userIdx: 1, gameId: '20260401SSHT0', team: '대구', groupType: 'cleanup' },
    { userIdx: 2, gameId: '20260401OBLT0', team: '부산', groupType: 'leadoff' },
  ];

  for (const p of placements) {
    const game = games.find((g) => g.gameId === p.gameId);
    if (!game) { fail(`경기 없음: ${p.gameId}`); continue; }
    if (!['scheduled', 'active', 'live', 'finished'].includes(game.status)) {
      fail(`배치 불가 상태: ${p.gameId} (${game.status})`);
      continue;
    }
    await Placement.create({
      userId: users[p.userIdx]._id,
      characterId: characters[p.userIdx]._id,
      gameId: p.gameId,
      team: p.team,
      groupType: p.groupType,
      date,
      status: 'active',
    });
    const userName = (users[p.userIdx] as unknown as { name: string }).name;
    ok(`${userName} → ${p.gameId} / ${p.team} ${p.groupType}`);
  }
}

async function printTokens(users: mongoose.Document[]) {
  log('\n🔑 테스트 JWT 토큰 (24h 유효):');
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  for (const u of users) {
    const user = u as unknown as { _id: mongoose.Types.ObjectId; email: string; name: string };
    const token = jwt.sign(
      { userId: String(user._id), email: user.email },
      secret,
      { expiresIn: '24h' }
    );
    console.log(`  ${user.name}: ${token}`);
  }
}

async function main() {
  console.log('🌱 비스트리그 시드 스크립트 시작\n');
  await mongoose.connect(MONGODB_URI);
  ok('MongoDB 연결');

  await clearAll();
  const users      = await seedUsers();
  const characters = await seedCharacters(users);
  const games      = await seedGames();
  await seedPlacements(users, characters, games);
  await printTokens(users);

  console.log('\n✨ 시드 완료!\n');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error('시드 실패:', e); process.exit(1); });
