import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/beastleague';

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('DB 연결 완료');

  const db = mongoose.connection.db!;
  const characters = db.collection('characters');

  const result = await characters.updateMany(
    { totalXp: { $exists: false } },
    [
      {
        $set: {
          totalXp: { $ifNull: ['$xp', 0] },
          currentXp: { $ifNull: ['$xp', 0] },
          stats: {
            $ifNull: ['$stats', { power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 }]
          },
        },
      },
    ]
  );

  console.log(`${result.modifiedCount}명 마이그레이션 완료`);
  console.log('totalXp = currentXp = 기존 xp, stats 초기화');

  await mongoose.disconnect();
}

migrate().catch(console.error);
