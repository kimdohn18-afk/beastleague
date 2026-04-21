import * as readline from 'readline';

const API_URL = process.env.API_URL || 'https://beastleague.onrender.com';
const API_KEY = process.env.INTERNAL_API_KEY || '';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function fetchTodayGames(date: string) {
  const res = await fetch(`${API_URL}/api/internal/games?date=${date}`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error(`게임 목록 조회 실패: ${res.status}`);
  return res.json();
}

async function submitScore(gameId: string, homeScore: number, awayScore: number) {
  const res = await fetch(`${API_URL}/api/internal/games/${gameId}/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ homeScore, awayScore }),
  });
  if (!res.ok) throw new Error(`스코어 입력 실패: ${res.status}`);
  return res.json();
}

async function settleGame(gameId: string) {
  const res = await fetch(`${API_URL}/api/internal/games/${gameId}/settle`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error(`정산 실패: ${res.status}`);
  return res.json();
}

async function main() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);
  const date = (await ask(`날짜 (기본: ${today}): `)).trim() || today;

  console.log(`\n📅 ${date} 경기 목록 조회 중...`);
  const games = await fetchTodayGames(date);

  if (!games.length) {
    console.log('경기가 없습니다.');
    rl.close();
    return;
  }

  console.log('\n경기 목록:');
  games.forEach((g: any, i: number) => {
    const status = g.status === 'finished' ? '✅ 완료' : '⏳ 대기';
    const score = g.status === 'finished'
      ? `${g.homeScore} : ${g.awayScore}`
      : '- : -';
    console.log(`  ${i + 1}. [${status}] ${g.homeTeam} ${score} ${g.awayTeam} (${g.gameId})`);
  });

  const pendingGames = games.filter((g: any) => g.status !== 'finished');

  if (pendingGames.length === 0) {
    console.log('\n모든 경기가 이미 완료되었습니다.');

    const doSettle = (await ask('정산 실행할까요? (y/n): ')).trim().toLowerCase();
    if (doSettle === 'y') {
      for (const g of games) {
        console.log(`  정산 중: ${g.gameId}...`);
        try {
          const result = await settleGame(g.gameId);
          console.log(`  ✅ ${result.settledPredictions || result.settledPlacements || 0}명 정산 완료`);
        } catch (e) {
          console.log(`  ⚠️ ${e}`);
        }
      }
    }
    rl.close();
    return;
  }

  console.log(`\n스코어 미입력 경기 ${pendingGames.length}개:\n`);

  for (const game of pendingGames) {
    console.log(`🏟️ ${game.homeTeam} vs ${game.awayTeam}`);
    const homeScore = parseInt(await ask(`  ${game.homeTeam} 점수: `), 10);
    const awayScore = parseInt(await ask(`  ${game.awayTeam} 점수: `), 10);

    if (isNaN(homeScore) || isNaN(awayScore)) {
      console.log('  ⏭️ 건너뜀\n');
      continue;
    }

    await submitScore(game.gameId, homeScore, awayScore);
    console.log(`  ✅ ${game.homeTeam} ${homeScore} : ${awayScore} ${game.awayTeam} 저장\n`);
  }

  const doSettle = (await ask('\n전체 정산 실행할까요? (y/n): ')).trim().toLowerCase();
  if (doSettle === 'y') {
    for (const g of games) {
      console.log(`  정산 중: ${g.gameId}...`);
      try {
        const result = await settleGame(g.gameId);
        console.log(`  ✅ ${result.settledPredictions || result.settledPlacements || 0}명 정산 완료`);
      } catch (e) {
        console.log(`  ⚠️ ${e}`);
      }
    }
  }

  console.log('\n🎉 완료!');
  rl.close();
}

main().catch(console.error);
