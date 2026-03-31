/**
 * KBO 경기 데이터 수집기 v3 - 디버깅 + 파싱 수정
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
  time: string;
  stadium: string;
}

export interface BatterRecord {
  order: number;
  position: string;
  name: string;
  atBats: number;
  hits: number;
  rbi: number;
  runs: number;
  battingAvg: number;
  details: string[];
}

export interface GameEventSummary {
  homeRuns: string[];
  doubles: string[];
  triples: string[];
  steals: string[];
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
  events: GameEventSummary;
}

// ============ HTTP 요청 ============

async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000,
  });
  return typeof res.data === 'string' ? res.data : String(res.data);
}

// ============ 1. 경기 일정 수집 (텍스트 기반 파싱) ============

export async function fetchSchedule(date: string): Promise<GameSchedule[]> {
  const dateParam = date.replace(/-/g, '');
  const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dateParam}`;
  const html = await fetchHtml(url);
  const games: GameSchedule[] = [];

  // gameId 추출: 링크에서 gameId 패턴
  const gameIdRegex = /gameId=(\d{8}[A-Z]{2,6}\d)/g;
  const allGameIds: string[] = [];
  let m;
  while ((m = gameIdRegex.exec(html)) !== null) {
    if (!allGameIds.includes(m[1])) {
      allGameIds.push(m[1]);
    }
  }

  console.log(`  gameId ${allGameIds.length}개 발견: ${allGameIds.join(', ')}`);

  // 각 gameId에 대해 팀과 스코어 추출
  // HTML에서 "팀A_숫자vs숫자_팀B" 패턴 또는 "팀A_vs_팀B" 패턴 찾기
  const $ = cheerio.load(html);
  const textContent = $('body').text();

  // 결과 경기: "팀A_숫자vs숫자_팀B"
  const resultRegex = /(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)\s*(\d+)\s*vs\s*(\d+)\s*(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)/g;
  const results: Array<{ away: string; awayScore: number; homeScore: number; home: string }> = [];

  while ((m = resultRegex.exec(textContent)) !== null) {
    results.push({
      away: m[1], awayScore: parseInt(m[2]),
      homeScore: parseInt(m[3]), home: m[4],
    });
  }

  // 예정 경기: "팀A vs 팀B" (스코어 없음)
  const schedRegex = /(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)\s*vs\s*(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)/g;
  const scheduledGames: Array<{ away: string; home: string }> = [];

  while ((m = schedRegex.exec(textContent)) !== null) {
    // 이미 결과에 있는 조합은 제외
    const exists = results.some(r => r.away === m![1] && r.home === m![4]);
    if (!exists) {
      scheduledGames.push({ away: m[1], home: m[2] });
    }
  }

  console.log(`  종료 경기: ${results.length}개, 예정 경기: ${scheduledGames.length}개`);

  // 구장 추출
  const stadiums = textContent.match(/(잠실|문학|대구|창원|대전|수원|사직|고척|광주)/g) || [];

  // 시간 추출
  const times = textContent.match(/\d{2}:\d{2}/g) || [];

  // 결과 경기 매핑
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
      time: times[i] || '18:30',
      stadium: stadiums[i] || '',
    });
    gameIdx++;
  }

  // 예정 경기 매핑
  for (let i = 0; i < scheduledGames.length; i++) {
    const s = scheduledGames[i];
    games.push({
      gameId: allGameIds[gameIdx] || `${dateParam}GAME${gameIdx}`,
      date,
      awayTeam: s.away,
      homeTeam: s.home,
      status: 'scheduled',
      time: times[results.length + i] || '18:30',
      stadium: stadiums[results.length + i] || '',
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

  // 날짜
  const bodyText = $('body').text();
  const dateMatch = bodyText.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

  // 팀 이름: WIN/LOSE 또는 AWAY/HOME 주변
  const teamNames = ['KT','LG','SSG','NC','KIA','두산','롯데','삼성','한화','키움'];
  const foundTeams: string[] = [];
  $('strong, b, span.team').each((_, el) => {
    const text = $(el).text().trim();
    if (teamNames.includes(text) && !foundTeams.includes(text)) {
      foundTeams.push(text);
    }
  });

  // img alt에서도 찾기
  if (foundTeams.length < 2) {
    $('img').each((_, el) => {
      const alt = $(el).attr('alt') || '';
      if (teamNames.includes(alt) && !foundTeams.includes(alt)) {
        foundTeams.push(alt);
      }
    });
  }

  const awayTeam = foundTeams[0] || '';
  const homeTeam = foundTeams[1] || '';
  console.log(`  팀: ${awayTeam} vs ${homeTeam}`);

  // 스코어: R열 찾기
  let awayScore = 0;
  let homeScore = 0;

  // "R | H | E | B" 패턴의 테이블에서 R값 추출
  $('table').each((_, table) => {
    const ths = $(table).find('thead th, tr:first-child th');
    const headers = ths.map((__, th) => $(th).text().trim()).get();

    const rIdx = headers.indexOf('R');
    if (rIdx === -1) return;

    const rows = $(table).find('tbody tr');
    if (rows.length >= 2) {
      const awayR = $(rows[0]).find('td').eq(rIdx).text().trim();
      const homeR = $(rows[1]).find('td').eq(rIdx).text().trim();
      if (awayR && homeR) {
        awayScore = parseInt(awayR) || 0;
        homeScore = parseInt(homeR) || 0;
      }
    }
  });

  console.log(`  스코어: ${awayScore} - ${homeScore}`);

  // 타자 기록 파싱
  function parseBatters(sectionKeyword: string): BatterRecord[] {
    const records: BatterRecord[] = [];

    $('table').each((_, table) => {
      // 이 테이블 이전의 헤딩/캡션에 팀 이름이 포함되어 있는지 확인
      const prevText = $(table).prev().text() + $(table).parent().prev().text();
      const caption = $(table).find('caption').text();
      const tableText = prevText + caption;

      if (!tableText.includes('타자') && !tableText.includes(sectionKeyword)) return;

      $(table).find('tbody tr').each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 5) return;

        // 첫 셀이 숫자(타순)인지 확인
        const firstText = cells.eq(0).text().trim();
        const order = parseInt(firstText);

        if (isNaN(order) || order < 1 || order > 9) return;

        // 대타/대주자 등은 같은 타순이므로 첫 번째만 취급
        const position = cells.eq(1).text().trim();
        const name = cells.eq(2).text().trim();

        if (!name) return;

        // 마지막 5개: 타수, 안타, 타점, 득점, 타율
        const len = cells.length;
        const atBats = parseInt(cells.eq(len - 5).text().trim()) || 0;
        const hits = parseInt(cells.eq(len - 4).text().trim()) || 0;
        const rbi = parseInt(cells.eq(len - 3).text().trim()) || 0;
        const runs = parseInt(cells.eq(len - 2).text().trim()) || 0;
        const avgText = cells.eq(len - 1).text().trim();
        const battingAvg = avgText === '-' ? 0 : parseFloat(avgText) || 0;

        // 이닝별 상세 (3번째~마지막5개 전까지)
        const details: string[] = [];
        for (let i = 3; i < len - 5; i++) {
          details.push(cells.eq(i).text().trim());
        }

        records.push({
          order, position, name,
          atBats, hits, rbi, runs, battingAvg,
          details,
        });
      });
    });

    return records;
  }

  // 원정/홈 타자 파싱 - 팀 이름으로 구분
  let awayBatters = parseBatters(awayTeam);
  let homeBatters = parseBatters(homeTeam);

  // 팀 이름으로 안 되면 순서대로 (첫 번째 타자 테이블 = 원정, 두 번째 = 홈)
  if (awayBatters.length === 0 && homeBatters.length === 0) {
    console.log('  팀 이름 매칭 실패, 순서 기반 파싱 시도...');

    const allBatterTables: BatterRecord[][] = [];

    $('table').each((_, table) => {
      const records: BatterRecord[] = [];
      $(table).find('tbody tr').each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 8) return;

        const firstText = cells.eq(0).text().trim();
        const order = parseInt(firstText);
        if (isNaN(order) || order < 1 || order > 9) return;

        const position = cells.eq(1).text().trim();
        const name = cells.eq(2).text().trim();
        if (!name) return;

        const len = cells.length;
        const atBats = parseInt(cells.eq(len - 5).text().trim()) || 0;
        const hits = parseInt(cells.eq(len - 4).text().trim()) || 0;
        const rbi = parseInt(cells.eq(len - 3).text().trim()) || 0;
        const runs = parseInt(cells.eq(len - 2).text().trim()) || 0;
        const avgText = cells.eq(len - 1).text().trim();
        const battingAvg = avgText === '-' ? 0 : parseFloat(avgText) || 0;

        const details: string[] = [];
        for (let i = 3; i < len - 5; i++) {
          details.push(cells.eq(i).text().trim());
        }

        records.push({ order, position, name, atBats, hits, rbi, runs, battingAvg, details });
      });

      if (records.length >= 5) {
        allBatterTables.push(records);
      }
    });

    console.log(`  타자 테이블 ${allBatterTables.length}개 발견`);

    if (allBatterTables.length >= 2) {
      awayBatters = allBatterTables[0];
      homeBatters = allBatterTables[1];
    } else if (allBatterTables.length === 1) {
      awayBatters = allBatterTables[0];
    }
  }

  console.log(`  원정 타자: ${awayBatters.length}명, 홈 타자: ${homeBatters.length}명`);

  // 경기 이벤트
  const events: GameEventSummary = { homeRuns: [], doubles: [], triples: [], steals: [] };

  $('th').each((_, th) => {
    const label = $(th).text().trim();
    const td = $(th).next('td');
    if (!td.length) return;
    const value = td.text().trim();

    if (label === '홈런' && value) events.homeRuns = value.split(/\s{2,}/);
    else if (label === '2루타' && value) events.doubles = value.split(/\s{2,}/);
    else if (label === '3루타' && value) events.triples = value.split(/\s{2,}/);
    else if (label === '도루' && value) events.steals = value.split(/\s{2,}/);
  });

  console.log(`  이벤트 - 홈런: ${events.homeRuns.length}, 2루타: ${events.doubles.length}, 도루: ${events.steals.length}`);

  return {
    gameId, date, homeTeam, awayTeam,
    homeScore, awayScore,
    homeBatters, awayBatters,
    events,
  };
}

// ============ 3. XP 계산 ============

export function calculateBatterXp(batter: BatterRecord, events: GameEventSummary): number {
  let xp = 0;
  xp += batter.hits * 10;
  for (const hr of events.homeRuns) { if (hr.includes(batter.name)) xp += 40; }
  for (const d of events.doubles) { if (d.includes(batter.name)) xp += 10; }
  for (const t of events.triples) { if (t.includes(batter.name)) xp += 20; }
  for (const s of events.steals) { if (s.includes(batter.name)) xp += 15; }
  xp += batter.runs * 10;
  const strikeouts = batter.details.filter(d => d === '삼진').length;
  xp -= strikeouts * 10;
  const walks = batter.details.filter(d => d === '4구' || d === '사구').length;
  xp += walks * 10;
  return xp;
}

// ============ 4. 서버 전송 ============

async function sendToServer(game: GameSchedule, boxScore: BoxScoreResult | null, apiUrl: string, apiKey: string): Promise<void> {
  try {
    const gameData = {
      gameId: game.gameId, date: game.date,
      homeTeam: game.homeTeam, awayTeam: game.awayTeam,
      homeScore: game.homeScore, awayScore: game.awayScore,
      status: game.status,
      batterRecords: boxScore ? { away: boxScore.awayBatters, home: boxScore.homeBatters } : undefined,
      events: boxScore?.events,
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

// ============ 5. 메인 ============

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

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
        const xp = calculateBatterXp(b, result.events);
        console.log(`  ${b.order}번 ${b.position} ${b.name}: ${b.atBats}타수 ${b.hits}안타 ${b.rbi}타점 ${b.runs}득점 → XP ${xp > 0 ? '+' : ''}${xp}`);
      });
      console.log(`\n[${result.homeTeam} 타자]`);
      result.homeBatters.forEach(b => {
        const xp = calculateBatterXp(b, result.events);
        console.log(`  ${b.order}번 ${b.position} ${b.name}: ${b.atBats}타수 ${b.hits}안타 ${b.rbi}타점 ${b.runs}득점 → XP ${xp > 0 ? '+' : ''}${xp}`);
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
          box.awayBatters.slice(0, 9).forEach(b => {
            const xp = calculateBatterXp(b, box.events);
            console.log(`    ${b.order}번 ${b.name}: ${b.hits}안타 ${b.runs}득점 → XP ${xp > 0 ? '+' : ''}${xp}`);
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
    // HTML 원본 구조 확인용
    const date = param || todayKST();
    const dateParam = date.replace(/-/g, '');
    const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dateParam}`;
    const html = await fetchHtml(url);
    console.log(`HTML 길이: ${html.length}`);
    console.log(`처음 3000자:\n${html.substring(0, 3000)}`);

  } else {
    console.log('사용법:');
    console.log('  npx ts-node src/kbo-scraper.ts schedule [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts boxscore [gameId]');
    console.log('  npx ts-node src/kbo-scraper.ts daily [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts debug [YYYY-MM-DD]');
  }
}

main().catch(console.error);
