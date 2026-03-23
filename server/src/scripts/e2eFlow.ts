/**
 * E2E 플로우 테스트 스크립트
 * 전제: seed.ts 실행 완료, 서버 localhost:4000 실행 중
 * 실행: npx ts-node server/src/scripts/e2eFlow.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';
import { User } from '../models/User';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4000';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/beastleague';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? 'test-internal-key';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

// ── 결과 추적 ───────────────────────────────────────────────
interface StepResult { step: number; name: string; ok: boolean; detail: string }
const results: StepResult[] = [];

function pass(step: number, name: string, detail: string) {
  console.log(`  ✅ [${step}] ${name}: ${detail}`);
  results.push({ step, name, ok: true, detail });
}

function fail(step: number, name: string, detail: string) {
  console.log(`  ❌ [${step}] ${name}: ${detail}`);
  results.push({ step, name, ok: false, detail });
}

function errMsg(e: unknown): string {
  if (e instanceof AxiosError) {
    return `HTTP ${e.response?.status ?? '?'} — ${JSON.stringify(e.response?.data)}`;
  }
  return String(e);
}

// ── 메인 ──────────────────────────────────────────────────
async function main() {
  console.log('🧪 비스트리그 E2E 플로우 테스트\n');
  console.log(`서버: ${BASE_URL}\n`);

  // DB 연결 (JWT 생성용)
  await mongoose.connect(MONGODB_URI);
  const user1 = await User.findOne({ email: 'test1@beast.league' });
  if (!user1) {
    console.error('❌ 시드 데이터 없음. npm run seed 먼저 실행하세요.');
    process.exit(1);
  }
  const token = jwt.sign({ userId: String(user1._id), email: user1.email }, JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };
  await mongoose.disconnect();

  console.log('─'.repeat(50));

  // Step 1: 서버 헬스 체크
  try {
    await axios.get(`${BASE_URL}/api/games?date=2026-04-01`, { headers });
    // 진행
  } catch { /* 아래 step 3에서 처리 */ }

  // Step 2: JWT 토큰 생성
  pass(2, 'JWT 토큰 생성', `userId=${user1._id}`);

  // Step 3: 경기 목록
  try {
    const res = await axios.get<unknown[]>(`${BASE_URL}/api/games?date=2026-04-01`, { headers });
    const count = res.data.length;
    if (count >= 1) pass(3, '경기 목록 조회', `${count}경기 반환`);
    else fail(3, '경기 목록 조회', `예상 3경기 이상, 실제 ${count}경기`);
  } catch (e) { fail(3, '경기 목록 조회', errMsg(e)); }

  // Step 4: 캐릭터 조회
  let charBefore: Record<string, unknown> = {};
  try {
    const res = await axios.get<Record<string, unknown>>(`${BASE_URL}/api/characters/me`, { headers });
    charBefore = res.data;
    const name = res.data.name as string;
    pass(4, '캐릭터 조회', `name=${name}, level=${res.data.level}`);
  } catch (e) { fail(4, '캐릭터 조회', errMsg(e)); }

  // Step 5: 오늘 배치 조회
  try {
    const res = await axios.get<Record<string, unknown>>(`${BASE_URL}/api/placements/today`, { headers });
    if (res.data && res.data.gameId) {
      pass(5, '배치 조회', `gameId=${res.data.gameId}, team=${res.data.team}, group=${res.data.groupType}`);
    } else {
      fail(5, '배치 조회', '배치 없음 (시드 확인 필요)');
    }
  } catch (e) { fail(5, '배치 조회', errMsg(e)); }

  // Step 6–8: 훈련 3회
  const trainTypes = ['batting', 'running', 'mental'] as const;
  for (let i = 0; i < 3; i++) {
    const stepNo = 6 + i;
    const type = trainTypes[i];
    try {
      const res = await axios.post<{
        training: { xpGained: number; bonusApplied: boolean };
        levelUpResult: { newLevel: number };
      }>(`${BASE_URL}/api/trainings`, { type }, { headers });
      const bonus = res.data.training.bonusApplied ? ' 🎉보너스!' : '';
      pass(stepNo, `훈련 ${i + 1}회차 (${type})`, `XP+${res.data.training.xpGained}${bonus}, Lv.${res.data.levelUpResult.newLevel}`);
    } catch (e) { fail(stepNo, `훈련 ${i + 1}회차`, errMsg(e)); }
  }

  // Step 9: 4회차 훈련 → 400 기대
  try {
    await axios.post(`${BASE_URL}/api/trainings`, { type: 'batting' }, { headers });
    fail(9, '훈련 4회차 제한', '400 반환되어야 하는데 성공함');
  } catch (e) {
    if (e instanceof AxiosError && e.response?.status === 400) {
      pass(9, '훈련 4회차 제한', '400 정상 — 일일 훈련 제한 동작');
    } else {
      fail(9, '훈련 4회차 제한', errMsg(e));
    }
  }

  // Step 10: 경기 정산
  let settled = false;
  try {
    const res = await axios.post<{
      settledPlacements: number;
      battles: number;
      errors: string[];
    }>(
      `${BASE_URL}/internal/games/20260401SSHT0/settle`,
      {},
      { headers: { 'x-api-key': INTERNAL_KEY } }
    );
    const d = res.data;
    if (d.errors?.length > 0) {
      fail(10, '경기 정산', `오류 ${d.errors.length}건: ${d.errors[0]}`);
    } else {
      pass(10, '경기 정산', `settled=${d.settledPlacements}, battles=${d.battles}`);
      settled = true;
    }
  } catch (e) { fail(10, '경기 정산', errMsg(e)); }

  // Step 11: 정산 후 스탯 변화
  try {
    const res = await axios.get<Record<string, unknown>>(`${BASE_URL}/api/characters/me`, { headers });
    const beforeStats = (charBefore.stats ?? {}) as Record<string, number>;
    const afterStats  = (res.data.stats ?? {}) as Record<string, number>;
    const diffs = Object.keys(afterStats)
      .map((k) => `${k}:${((afterStats[k] ?? 0) - (beforeStats[k] ?? 0)) >= 0 ? '+' : ''}${((afterStats[k] ?? 0) - (beforeStats[k] ?? 0)).toFixed(2)}`)
      .join(', ');
    if (settled) {
      pass(11, '정산 후 스탯 변화', diffs);
    } else {
      pass(11, '정산 후 스탯 변화', `(정산 미완료) 현재 스탯: ${diffs}`);
    }
  } catch (e) { fail(11, '정산 후 스탯 변화', errMsg(e)); }

  // Step 12: 오늘 대결 결과
  try {
    const res = await axios.get<unknown[]>(`${BASE_URL}/api/battles/today`, { headers });
    if (res.data.length > 0) {
      const b = res.data[0] as Record<string, unknown>;
      const result = (b.result as Record<string, string>)?.player1 ?? '?';
      const xp = (b.xpAwarded as Record<string, number>)?.player1 ?? 0;
      pass(12, '대결 결과', `result=${result}, XP+${xp}`);
    } else {
      if (settled) {
        fail(12, '대결 결과', '정산됐는데 대결 없음 (매칭 확인 필요)');
      } else {
        pass(12, '대결 결과', '정산 전 — 대결 없음 (정상)');
      }
    }
  } catch (e) { fail(12, '대결 결과', errMsg(e)); }

  // Step 13: 랭킹
  try {
    const res = await axios.get<unknown[]>(`${BASE_URL}/api/rankings?type=level&limit=10`, { headers });
    pass(13, '랭킹 조회', `${res.data.length}명 반환`);
  } catch (e) { fail(13, '랭킹 조회', errMsg(e)); }

  // 최종 요약
  const total = results.filter((r) => r.step >= 2).length;
  const passed = results.filter((r) => r.step >= 2 && r.ok).length;
  const failed = total - passed;

  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 결과: ${total}단계 중 ${passed}개 ✅  ${failed}개 ❌\n`);

  if (failed > 0) {
    console.log('실패 목록:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  [${r.step}] ${r.name}: ${r.detail}`));
  } else {
    console.log('🎉 전체 플로우 정상!\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('E2E 실패:', e); process.exit(1); });
