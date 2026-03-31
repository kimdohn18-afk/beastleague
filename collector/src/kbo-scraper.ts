async function main() {
  const command = process.argv[2];
  const param = process.argv[3];
  const apiUrl = process.env.API_URL || 'https://beastleague.onrender.com';
  const apiKey = process.env.INTERNAL_API_KEY || '';

  if (command === 'schedule') {
    const date = param || todayKST();
    console.log(`📅 경기 일정 수집: ${date}`);
    const games = await fetchSchedule(date);
    for (const g of games) {
      console.log(`  ⚾ ${g.awayTeam} ${g.awayScore ?? ''} vs ${g.homeScore ?? ''} ${g.homeTeam} [${g.status}] (${g.gameId})`);
    }
    console.log(`총 ${games.length}경기`);

  } else if (command === 'boxscore') {
    if (!param) { console.error('gameId를 입력하세요'); process.exit(1); }
    console.log(`📊 박스스코어 수집: ${param}`);
    const result = await fetchBoxScore(param);
    if (result) {
      console.log(`\n${result.awayTeam} ${result.awayScore} vs ${result.homeScore} ${result.homeTeam}`);
      console.log(`\n[${result.awayTeam} 타자]`);
      result.awayBatters.forEach(b => {
        console.log(`  ${b.order}번 타자: ${b.atBats}타수 ${b.hits}안타 (홈런${b.homeRuns} 2루타${b.doubles}) ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
      });
      console.log(`\n[${result.homeTeam} 타자]`);
      result.homeBatters.forEach(b => {
        console.log(`  ${b.order}번 타자: ${b.atBats}타수 ${b.hits}안타 (홈런${b.homeRuns} 2루타${b.doubles}) ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
      });
    }

  } else if (command === 'daily') {
    const date = param || todayKST();
    console.log(`\n=== ${date} 전체 수집 시작 ===\n`);
    const games = await fetchSchedule(date);
    console.log(`${games.length}경기 발견\n`);
    for (const game of games) {
      console.log(`⚾ ${game.awayTeam} vs ${game.homeTeam} - ${game.status}`);
      if (game.status === 'finished') {
        console.log(`  스코어: ${game.awayScore} - ${game.homeScore}`);
        const box = await fetchBoxScore(game.gameId);
        if (box) {
          console.log(`  원정 타자:`);
          box.awayBatters.forEach(b => {
            console.log(`    ${b.order}번: ${b.hits}안타 ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
          });
          console.log(`  홈 타자:`);
          box.homeBatters.forEach(b => {
            console.log(`    ${b.order}번: ${b.hits}안타 ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
          });
        }
        if (apiKey) {
          await sendToServer(game, box, apiUrl, apiKey);
        } else {
          console.log(`  ⚠️ API_KEY 없음, 서버 전송 건너뜀`);
        }
      }
      console.log('');
    }
    console.log(`=== 수집 완료 ===`);

  } else if (command === 'debug') {
    const date = param || todayKST();
    const dateParam = date.replace(/-/g, '');
    const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dateParam}`;
    const html = await fetchHtml(url);
    console.log(`HTML 길이: ${html.length}`);
    console.log(html.substring(0, 3000));

  } else {
    console.log('사용법:');
    console.log('  npx ts-node src/kbo-scraper.ts schedule [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts boxscore [gameId]');
    console.log('  npx ts-node src/kbo-scraper.ts daily [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts debug [YYYY-MM-DD]');
  }
}

main().catch(console.error);
