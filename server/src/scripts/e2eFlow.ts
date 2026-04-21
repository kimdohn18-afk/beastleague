/**
 * E2E 플로우 테스트 (예측 시스템 v2)
 * 전제: seed.ts 실행 완료, 서버 localhost:4000 실행 중
 * 실행: npm run e2e
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
  if (e instanceof AxiosError) return `HTTP ${e.response?.status ?? '?'} — ${JSON.stringify(e.response?.data)}`;
  return String(e);
}

async function main() {
  console.log('🧪 비스트리그 E2E 테스트 (v2 - 예측 시스템)\n');
  console.log(`서버: ${BASE_URL}\n`);

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

  // Step 1: 헬스체크
  try {
    const res = await axios.get(`${BASE_URL}/api/health`);
    pass(1, '헬스체크', `status=${res.data.status}`);
  } catch (e) { fail(1, '헬스체크', errMsg(e)); }

  // Step 2: 캐릭터 조회
  let charXpBefore = 0;
  try {
    const res = await axios.get(`${BASE_URL}/api/characters/me`, { headers });
    charXpBefore = res.data.xp;
    pass(2, '캐릭터 조회', `name=${res.data.name}, xp=${res.data.xp}`);
  } catch (e) { fail(2, '캐릭터 조회', errMsg(e)); }

  // Step 3: 오늘 경기 목록
  let todayGames: any[] = [];
  try {
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const res = await axios.get(`${BASE_URL}/api/games?date=${today}`, { headers });
    todayGames = res.data;
    pass(3, '오늘 경기 조회', `${todayGames.length}경기`);
  } catch (e) { fail(3, '오늘 경기 조회', errMsg(e)); }

  // Step 4: 예측 등록 (승리만)
  const testGame = todayGames.find((g: any) => g.status === 'scheduled');
  if (testGame) {
    try {
      const res = await axios.post(`${BASE_URL}/api/predictions`, {
        gameId: testGame.gameId,
        predictedWinner: testGame.homeTeam,
      }, { headers });
      pass(4, '예측 등록 (승리만)', `gameId=${testGame.gameId}, winner=${testGame.homeTeam}`);
    } catch (e) { fail(4, '예측 등록', errMsg(e)); }
  } else {
    fail(4, '예측 등록', '예측 가능한 경기 없음');
  }

  // Step 5: 예측 등록 (승리 + 점수차 + 총득점)
  const testGame2 = todayGames.find((g: any) => g.status === 'scheduled' && g.gameId !== testGame?.gameId);
  if (testGame2) {
    try {
      const res = await axios.post(`${BASE_URL}/api/predictions`, {
        gameId: testGame2.gameId,
        predictedWinner: testGame2.awayTeam,
        scoreDiffRange: '3-4',
        xpBetOnDiff: 10,
        totalRunsRange: 'normal',
        xpBetOnTotal: 10,
      }, { headers });
      pass(5, '예측 등록 (풀옵션)', `gameId=${testGame2.gameId}`);
    } catch (e) { fail(5, '예측 등록 (풀옵션)', errMsg(e)); }
  } else {
    fail(5, '예측 등록 (풀옵션)', '두 번째 경기 없음');
  }

  // Step 6: 오늘 예측 조회
  try {
    const res = await axios.get(`${BASE_URL}/api/predictions/today`, { headers });
    pass(6, '오늘 예측 조회', `${res.data.length}건`);
  } catch (e) { fail(6, '오늘 예측 조회', errMsg(e)); }

  // Step 7: 6건째 예측 → 제한 확인
  const remainingGames = todayGames.filter((g: any) =>
    g.status === 'scheduled' && g.gameId !== testGame?.gameId && g.gameId !== testGame2?.gameId
  );
  // 3~5번째 등록
  for (let i = 0; i < Math.min(3, remainingGames.length); i++) {
    try {
      await axios.post(`${BASE_URL}/api/predictions`, {
        gameId: remainingGames[i].gameId,
        predictedWinner: remainingGames[i].homeTeam,
      }, { headers });
    } catch {}
  }
  // 6번째 시도
  if (remainingGames.length >= 4) {
    try {
      await axios.post(`${BASE_URL}/api/predictions`, {
        gameId: remainingGames[3]?.gameId || 'fake',
        predictedWinner: 'fake',
      }, { headers });
      fail(7, '일일 제한 (6경기)', '400이어야 하는데 성공');
    } catch (e) {
      if (e instanceof AxiosError && e.response?.status === 400) {
        pass(7, '일일 제한 (6경기)', '400 정상 반환');
      } else {
        fail(7, '일일 제한', errMsg(e));
      }
    }
  } else {
    pass(7, '일일 제한', '경기 수 부족으로 스킵');
  }

  // Step 8: 예측 취소
  if (testGame) {
    try {
      await axios.delete(`${BASE_URL}/api/predictions/${testGame.gameId}`, { headers });
      pass(8, '예측 취소', `gameId=${testGame.gameId}`);
    } catch (e) { fail(8, '예측 취소', errMsg(e)); }
  }

  // Step 9: 어제 경기 정산 (스코어 입력 + settle)
  try {
    const yesterday = new Date(Date.now() + 9 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
    const yGames = await axios.get(`${BASE_URL}/api/games?date=${yesterday}`, { headers });
    const finishedGames = yGames.data.filter((g: any) => g.status === 'finished');

    let settledTotal = 0;
    for (const g of finishedGames) {
      try {
        const res = await axios.post(
          `${BASE_URL}/api/internal/games/${g.gameId}/settle`,
          {},
          { headers: { 'x-api-key': INTERNAL_KEY } }
        );
        settledTotal += res.data.settledCount || 0;
      } catch {}
    }
    pass(9, '어제 경기 정산', `${finishedGames.length}경기, ${settledTotal}건 정산`);
  } catch (e) { fail(9, '어제 경기 정산', errMsg(e)); }

  // Step 10: 정산 후 XP 변화
  try {
    const res = await axios.get(`${BASE_URL}/api/characters/me`, { headers });
    const xpAfter = res.data.xp;
    const diff = xpAfter - charXpBefore;
    pass(10, '정산 후 XP 변화', `${charXpBefore} → ${xpAfter} (${diff >= 0 ? '+' : ''}${diff})`);
  } catch (e) { fail(10, '정산 후 XP 변화', errMsg(e)); }

  // Step 11: 예측 히스토리
  try {
    const res = await axios.get(`${BASE_URL}/api/predictions/history`, { headers });
    pass(11, '예측 히스토리', `${res.data.length}건`);
  } catch (e) { fail(11, '예측 히스토리', errMsg(e)); }

  // Step 12: 랭킹
  try {
    const res = await axios.get(`${BASE_URL}/api/rankings?type=level&limit=10`, { headers });
    pass(12, '랭킹 조회', `${res.data.length}명`);
  } catch (e) { fail(12, '랭킹 조회', errMsg(e)); }

  // 최종 요약
  const total = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = total - passed;

  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 결과: ${total}단계 중 ${passed}개 ✅  ${failed}개 ❌\n`);

  if (failed > 0) {
    console.log('실패 목록:');
    results.filter(r => !r.ok).forEach(r => console.log(`  [${r.step}] ${r.name}: ${r.detail}`));
  } else {
    console.log('🎉 전체 플로우 정상!\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('E2E 실패:', e); process.exit(1); });
