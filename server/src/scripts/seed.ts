/**
 * 로컬 테스트용 시드 스크립트 (배치 시스템)
 * 실행: npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Character } from '../models/Character';
import { Game } from '../models/Game';
import { Placement } from '../models/Placement';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/beastleague';

const log = (msg: string) => console.log(msg);
const ok = (msg: string) => console.log(`  ✅ ${msg}`);

async function clearAll() {
  log('\n🗑️  기존 데이터 삭제...');
  await Promise.all([
    User.deleteMany({}),
    Character.deleteMany({}),
    Game.deleteMany({}),
    Placement.deleteMany({}),
  ]);
  ok('전체 컬렉션 초기화 완료');
}

async function seedUsers() {
  log('\n👤 유저 생성...');
  const users = await User.insertMany([
    { email: 'test1@beast.league', name: '테스터1', provider: 'google', providerId: 'g-test-001' },
    { email: 'test2@beast.league', name: '테스터2', provider: 'kakao', providerId: 'k-test-002' },
    { email: 'test3@beast.league', name: '테스터3', provider: 'google', providerId: 'g-test-003' },
  ]);
  users.forEach((u) => ok(`${u.name} (${u.email})`));
  return users;
}

async function seedCharacters(users: mongoose.Document[]) {
  log('\n🐾 캐릭터 생성...');
  const defs = [
    { name: '번개곰', animalType: 'bear', xp: 100 },
    { name: '질풍호', animalType: 'tiger', xp: 100 },
    { name: '하늘매', animalType: 'eagle', xp: 100 },
  ];
  const characters = [];
  for (let i = 0; i < users.length; i++) {
    const c = await Character.create({
      userId: users[i]._id,
      ...defs[i],
      tutorialCompleted: true,
    });
    ok(`${defs[i].name} (${defs[i].animalType}) — ${defs[i].xp} XP`);
    characters.push(c);
  }
  return characters;
}

async function seedGames() {
  log('\n⚾ 테스트 경기 생성...');
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() + 9 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);

  const gameData = [
    { gameId: `${yesterday.replace(/-/g, '')}HHSS0`, date: yesterday, homeTeam: '삼성', awayTeam: '한화', status: 'finished', startTime: '18:30', homeScore: 5, awayScore: 3 },
    { gameId: `${yesterday.replace(/-/g, '')}LGDS0`, date: yesterday, homeTeam: '두산', awayTeam: 'LG', status: 'finished', startTime: '18:30', homeScore: 2, awayScore: 7 },
    { gameId: `${yesterday.replace(/-/g, '')}KTKIA0`, date: yesterday, homeTeam: 'KIA', awayTeam: 'KT', status: 'finished', startTime: '18:30', homeScore: 4, awayScore: 4 },
    { gameId: `${today.replace(/-/g, '')}HHSS0`, date: today, homeTeam: '삼성', awayTeam: '한화', status: 'scheduled', startTime: '18:30' },
    { gameId: `${today.replace(/-/g, '')}LGDS0`, date: today, homeTeam: '두산', awayTeam: 'LG', status: 'scheduled', startTime: '18:30' },
    { gameId: `${today.replace(/-/g, '')}NCLT0`, date: today, homeTeam: '롯데', awayTeam: 'NC', status: 'scheduled', startTime: '18:30' },
    { gameId: `${today.replace(/-/g, '')}SSGKM0`, date: today, homeTeam: '키움', awayTeam: 'SSG', status: 'scheduled', startTime: '18:30' },
    { gameId: `${today.replace(/-/g, '')}KTKIA0`, date: today, homeTeam: 'KIA', awayTeam: 'KT', status: 'scheduled', startTime: '18:30' },
  ];

  for (const g of gameData) {
    await Game.findOneAndUpdate({ gameId: g.gameId }, { $set: g }, { upsert: true, new: true });
    ok(`${g.gameId} (${g.awayTeam} vs ${g.homeTeam} — ${g.status})`);
  }

  return gameData;
}

async function seedPlacements(
  users: mongoose.Document[],
  characters: mongoose.Document[],
  games: any[]
) {
  log('\n🎯 테스트 배치 생성 (어제 경기)...');
  const yesterday = games.filter(g => g.status === 'finished');

  if (yesterday[0]) {
    await Placement.create({
      userId: users[0]._id,
      characterId: characters[0]._id,
      gameId: yesterday[0].gameId,
      date: yesterday[0].date,
      team: '삼성',
      battingOrder: 4,
      predictedWinner: '삼성',
      status: 'active',
    });
    ok('테스터1 → 삼성 4번타자, 삼성 승리 예측');
  }

  if (yesterday[1]) {
    await Placement.create({
      userId: users[1]._id,
      characterId: characters[1]._id,
      gameId: yesterday[1].gameId,
      date: yesterday[1].date,
      team: 'LG',
      battingOrder: 3,
      predictedWinner: 'LG',
      status: 'active',
    });
    ok('테스터2 → LG 3번타자, LG 승리 예측');
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
  console.log('🌱 비스트리그 시드 스크립트 (배치 시스템)\n');
  await mongoose.connect(MONGODB_URI);
  ok('MongoDB 연결');

  await clearAll();
  const users = await seedUsers();
  const characters = await seedCharacters(users);
  const games = await seedGames();
  await seedPlacements(users, characters, games);
  await printTokens(users);

  console.log('\n✨ 시드 완료!\n');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error('시드 실패:', e); process.exit(1); });
