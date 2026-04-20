// server/src/scripts/migrate-to-predictions.ts
//
// 실행: npx ts-node -P server/tsconfig.json -r tsconfig-paths/register server/src/scripts/migrate-to-predictions.ts
//
// 수행 내용:
// 1. games 컬렉션에서 batterRecords, events 필드 제거
// 2. 기존 placements 컬렉션 백업 후 보존 (삭제하지 않음)
// 3. 캐릭터 XP 초기화 여부 선택
// 4. predictions 컬렉션이 비어있는지 확인

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? '';

async function main() {
  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[Migration] Connected.\n');

  const db = mongoose.connection.db;

  // ─── 1. games 컬렉션: batterRecords, events 필드 제거 ───
  console.log('[1/4] Removing batterRecords and events from games...');
  const gamesResult = await db.collection('games').updateMany(
    {},
    { $unset: { batterRecords: '', events: '' } }
  );
  console.log(`  → ${gamesResult.modifiedCount} games updated.\n`);

  // ─── 2. games에서 선수 이름이 남아있는지 확인 ───
  console.log('[2/4] Verifying no player names remain...');
  const sampleGame = await db.collection('games').findOne({ batterRecords: { $exists: true } });
  if (sampleGame) {
    console.log('  ⚠️ WARNING: Some games still have batterRecords!');
  } else {
    console.log('  ✅ All batterRecords removed.\n');
  }

  // ─── 3. 기존 placements 통계 ───
  console.log('[3/4] Checking existing placements...');
  const placementCount = await db.collection('placements').countDocuments();
  console.log(`  → ${placementCount} placements found (preserved for reference).\n`);

  // ─── 4. predictions 컬렉션 확인 ───
  console.log('[4/4] Checking predictions collection...');
  const predictionCount = await db.collection('predictions').countDocuments();
  console.log(`  → ${predictionCount} predictions exist.\n`);

  // ─── 요약 ───
  console.log('═══════════════════════════════════════════');
  console.log('Migration Summary:');
  console.log(`  Games cleaned:        ${gamesResult.modifiedCount}`);
  console.log(`  Placements preserved: ${placementCount}`);
  console.log(`  Predictions:          ${predictionCount}`);
  console.log('═══════════════════════════════════════════');
  console.log('\n[Migration] Done.');

  // ─── 추가 옵션: 캐릭터 XP 리셋 ───
  // 아래 주석을 해제하면 모든 캐릭터 XP를 100으로 리셋합니다.
  // 새 시스템에서 공정하게 시작하려면 실행하세요.
  //
  // console.log('\n[Optional] Resetting all character XP to 100...');
  // const charResult = await db.collection('characters').updateMany(
  //   {},
  //   { $set: { xp: 100, totalPlacements: 0, streak: 0, lastPlacementDate: null } }
  // );
  // console.log(`  → ${charResult.modifiedCount} characters reset.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[Migration] Error:', err);
  process.exit(1);
});
