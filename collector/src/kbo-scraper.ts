/**
 * KBO 경기 데이터 수집기 v6 - 완전한 단일 파일
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// ============ 타입 정의 ============
export interface GameSchedule {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';
}

export interface BatterRecord {
  order: number;
  atBats: number;
  hits: number;
  rbi: number;
  runs: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  stolenBases: number;
  walks: number;
  strikeouts: number;
  xp: number;
}

export interface BoxScoreResult {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeBatters: BatterRecord[];
  awayBatters: BatterRecord[];
}

// ============ HTTP 요청 ============
async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000,
  });
  return typeof res.data === 'string' ? res.data : String(res.data);
}

// ============ 오늘 날짜 (KST) ============
function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// ============ 1. 경기 일정 수집 ============
export async function fetchSchedule(date: string): Promise<GameSchedule[]> {
  const dateParam = date.replace(/-/g, '');
  const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dateParam}`;
  const html = await fetchHtml(url);
  const games: GameSchedule[] = [];

  // gameId 추출
  const gameIdRegex = /gameId=(\d{8}[A-Z]{2,6}\d)/g;
  let m: RegExpExecArray | null;
  const allGameIds: string[] = [];
  while ((m = gameIdRegex.exec(html)) !== null) {
    if (!allGameIds.includes(m[1])) allGameIds.push(m[1]);
  }
  console.log(`  gameId ${allGameIds.length}개 발견: ${allGameIds.join(', ')}`);

  const $ = cheerio.load(html);
  const textContent = $('body').text();

  // 종료된 경기 (점수 있음)
  const resultRegex = /(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)\s*(\d+)\s*vs\s*(\d+)\s*(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)/g;
  const results: Array<{ away: string; awayScore: number; homeScore: number; home: string }> = [];
  while ((m = resultRegex.exec(textContent)) !== null) {
    results.push({ away: m[1], awayScore: parseInt(m[2]), homeScore: parseInt(m[3]), home: m[4] });
  }

  // 예정 경기 (점수 없음)
  const schedRegex = /(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)\s*vs\s*(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)/g;
  const scheduledGames: Array<{ away: string; home: string }> = [];
  while ((m = schedRegex.exec(textContent)) !== null) {
    const exists = results.some((r) => r.away === m![1] && r.home === m![2]);
    if (!exists) scheduledGames.push({ away: m[1], home: m[2] });
  }

  console.log(`  종료 경기: ${results.length}개, 예정 경기: ${scheduledGames.length}개`);

  let gameIdx = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    games.push({
      gameId: allGameIds[gameIdx] || `${dateParam}GAME${gameIdx}`,
      date,
      awayTeam: r.away,
      homeTeam: r.home,
      awayScore: r.awayScore,
      homeScore: r.homeScore,
      status: 'finished',
    });
    gameIdx++;
  }
  for (let i = 0; i < scheduledGames.length; i++) {
    const s = scheduledGames[i];
    games.push({
      gameId: allGameIds[gameIdx] || `${dateParam}GAME${gameIdx}`,
      date,
      awayTeam: s.away,
      homeTeam: s.home,
      status: 'scheduled',
    });
    gameIdx++;
  }
  return games;
}

// ============ 2. 박스스코어 수집 ============
export async function fetchBoxScore(gameId: string): Promise<BoxScoreResult | null> {
  const year = gameId.substring(0, 4);
  const url = `https://www.koreabaseball.com/futures/schedule/BoxScore.aspx?leagueId=1&seriesId=0&seasonId=${year}&gameId=${gameId}`;
  console.log(`  URL: ${url}`);
  const html = await fetchHtml(url);
  console.log(`  HTML 길이: ${html.length}`);

  if (html.includes('이용에 불편을 드려') || html.length < 2000) {
    console.error(`  ❌ 박스스코어를 가져올 수 없습니다: ${gameId}`);
    return null;
  }

  const $ = cheerio.load(html);
  const bodyText = $('body').text();

  // 날짜
  const dm = bodyText.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  const date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '';

  // 팀 이름
  const teamList = ['KT', 'LG', 'SSG', 'NC', 'KIA', '두산', '롯데', '삼성', '한화', '키움'];
  const found: string[] = [];
  $('img').each((_: number, el: any) => {
    const alt = $(el).attr('alt') || '';
    if (teamList.includes(alt) && !found.includes(alt)) found.push(alt);
  });
  $('strong, b, span').each((_: number, el: any) => {
    const txt = $(el).text().trim();
    if (teamList.includes(txt) && !found.includes(txt)) found.push(txt);
  });
  const awayTeam = found[0] || '';
  const homeTeam = found[1] || '';
  console.log(`  팀: ${awayTeam} vs ${homeTeam}`);

  // 점수
  let awayScore = 0;
  let homeScore = 0;
  $('table').each((_: number, tbl: any) => {
    const ths = $(tbl).find('th').map((_: number, th: any) => $(th).text().trim()).get();
    if (!ths.includes('R')) return;
    const rIdx = ths.indexOf('R');
    const rows = $(tbl).find('tr').filter((_: number, r: any) => $(r).find('td').length > 0);
    if (rows.length >= 2) {
      awayScore = parseInt($(rows[0]).find('td').eq(rIdx).text()) || 0;
      homeScore = parseInt($(rows[1]).find('td').eq(rIdx).text()) || 0;
    }
  });
  console.log(`  스코어: ${awayScore} - ${homeScore}`);

  // 타자 섹션 분리
  const fullHtml = $.html();
  const sections = fullHtml.split(/타자/);
  console.log(`  '타자' 키워드로 분리된 섹션: ${sections.length}개`);

  function parseBatterSection(sectionHtml: string): BatterRecord[] {
    const s$ = cheerio.load(sectionHtml);
    const allTables = s$('table').toArray();
    console.log(`    섹션 내 테이블: ${allTables.length}개`);

    // 타자 테이블 찾기: 8개 이상의 td를 가진 행이 5개 이상인 테이블
    const batterTables: any[] = [];
    for (const tbl of allTables) {
      const rows = s$(tbl).find('tr').filter((_: number, r: any) => {
        const tds = s$(r).find('td');
        return tds.length >= 5;
      });
      if (rows.length >= 5) {
        batterTables.push(tbl);
      }
    }
    console.log(`    타자 후보 테이블: ${batterTables.length}개`);

    if (batterTables.length === 0) return [];

    // 첫 번째 타자 테이블 파싱
    const tbl = batterTables[0];
    const merged = new Map<number, BatterRecord>();
    for (let o = 1; o <= 9; o++) {
      merged.set(o, {
        order: o, atBats: 0, hits: 0, rbi: 0, runs: 0,
        doubles: 0, triples: 0, homeRuns: 0, stolenBases: 0,
        walks: 0, strikeouts: 0, xp: 0,
      });
    }

    s$(tbl).find('tbody tr, tr').each((_: number, row: any) => {
      const cells = s$(row).find('td');
      if (cells.length < 5) return;

      const firstCell = cells.eq(0).text().trim();
      const orderNum = parseInt(firstCell);
      if (isNaN(orderNum) || orderNum < 1 || orderNum > 9) return;

      const b = merged.get(orderNum);
      if (!b) return;

      // 이닝별 기록 파싱 (중간 셀들)
      const len = cells.length;
      // 마지막 4~5개 셀이 타수/안타/타점/득점/타율
      const atBats = parseInt(cells.eq(len - 5).text().trim()) || 0;
      const hits = parseInt(cells.eq(len - 4).text().trim()) || 0;
      const rbi = parseInt(cells.eq(len - 3).text().trim()) || 0;
      const runs = parseInt(cells.eq(len - 2).text().trim()) || 0;

      b.atBats += atBats;
      b.hits += hits;
      b.rbi += rbi;
      b.runs += runs;

      // 이닝별 디테일에서 이벤트 추출
      for (let i = 1; i < len - 5; i++) {
        const d = cells.eq(i).text().trim();
        if (!d || d === '-') continue;
        if (d.includes('홈')) b.homeRuns++;
        if (/2루타|[좌중우]2/.test(d)) b.doubles++;
        if (/3루타/.test(d)) b.triples++;
        if (d === '도루' || d.includes('도루')) b.stolenBases++;
        if (d === '4구' || d === '사구') b.walks++;
        if (d === '삼진' || d.includes('삼진')) b.strikeouts++;
      }
    });

    // XP 계산
    for (const [, b] of merged) {
      const singles = Math.max(0, b.hits - b.doubles - b.triples - b.homeRuns);
      let xp = 0;
      xp += singles * 10;
      xp += b.doubles * 20;
      xp += b.triples * 30;
      xp += b.homeRuns * 50;
      xp += b.walks * 10;
      xp += b.runs * 10;
      xp += b.stolenBases * 15;
      xp -= b.strikeouts * 10;
      b.xp = xp;
    }

    return Array.from(merged.values()).sort((a, b) => a.order - b.order);
  }

  let awayBatters: BatterRecord[] = [];
  let homeBatters: BatterRecord[] = [];

  // 섹션이 충분하면 원정/홈 분리
  if (sections.length >= 3) {
    // 첫 번째 '타자' 이후 ~ 두 번째 '타자' 전까지 = 원정
    // 두 번째 '타자' 이후 = 홈
    const awaySection = sections[1].split(/투수/)[0] || sections[1];
    const homeSection = sections[2].split(/투수/)[0] || sections[2];
    console.log('  원정 섹션 파싱...');
    awayBatters = parseBatterSection(awaySection);
    console.log('  홈 섹션 파싱...');
    homeBatters = parseBatterSection(homeSection);
  } else {
    console.log('  ⚠️ 타자 섹션 분리 실패, 전체 HTML에서 파싱 시도...');
    const allBatters = parseBatterSection(fullHtml);
    awayBatters = allBatters;
  }

  console.log(`  ${awayTeam}: ${awayBatters.filter((b: BatterRecord) => b.xp !== 0).length}명 XP 발생`);
  console.log(`  ${homeTeam}: ${homeBatters.filter((b: BatterRecord) => b.xp !== 0).length}명 XP 발생`);

  return { gameId, date, homeTeam, awayTeam, homeScore, awayScore, homeBatters, awayBatters };
}

// ============ 3. 서버 전송 ============
async function sendToServer(
  game: GameSchedule,
  boxScore: BoxScoreResult | null,
  apiUrl: string,
  apiKey: string
): Promise<void> {
  try {
    const gameData = {
      gameId: game.gameId,
      date: game.date,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      status: game.status,
      batterRecords: boxScore
        ? { away: boxScore.awayBatters, home: boxScore.homeBatters }
        : undefined,
    };
    await axios.post(`${apiUrl}/api/internal/games`, gameData, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      timeout: 30000,
    });
    console.log(`  ✅ 서버 전송 완료`);
  } catch (err: any) {
    console.error(`  ❌ 전송 실패: ${err.response?.data || err.message}`);
  }
}

// ============ 4. 메인 ============
async function main(): Promise<void> {
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
    if (!param) {
      console.error('gameId를 입력하세요');
      process.exit(1);
    }
    console.log(`📊 박스스코어 수집: ${param}`);
    const result = await fetchBoxScore(param);
    if (result) {
      console.log(`\n${result.awayTeam} ${result.awayScore} vs ${result.homeScore} ${result.homeTeam}`);
      console.log(`\n[${result.awayTeam} 타자]`);
      result.awayBatters.forEach((b: BatterRecord) => {
        console.log(`  ${b.order}번 타자: ${b.atBats}타수 ${b.hits}안타 (홈런${b.homeRuns} 2루타${b.doubles}) ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
      });
      console.log(`\n[${result.homeTeam} 타자]`);
      result.homeBatters.forEach((b: BatterRecord) => {
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
          box.awayBatters.forEach((b: BatterRecord) => {
            console.log(`    ${b.order}번: ${b.hits}안타 ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
          });
          console.log(`  홈 타자:`);
          box.homeBatters.forEach((b: BatterRecord) => {
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

  } else if (command === 'debug-box') {
    const gid = param || '20260329KTLG0';
    const year = gid.substring(0, 4);
    const url = `https://www.koreabaseball.com/futures/schedule/BoxScore.aspx?leagueId=1&seriesId=0&seasonId=${year}&gameId=${gid}`;
    const html = await fetchHtml(url);
    console.log(`HTML 길이: ${html.length}`);
    console.log(html.substring(0, 5000));

  } else {
    console.log('사용법:');
    console.log('  npx ts-node src/kbo-scraper.ts schedule [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts boxscore [gameId]');
    console.log('  npx ts-node src/kbo-scraper.ts daily [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts debug [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts debug-box [gameId]');
  }
}

main().catch(console.error);
