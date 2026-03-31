/**
 * KBO 경기 데이터 수집기 v2
 * cheerio + axios 기반 HTML 파싱
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
  details: string[];   // 이닝별: ['우안','투땅','','','좌비','','4구','','우안']
}

export interface GameEventSummary {
  homeRuns: string[];   // ['허경민1호(6회2점 김진성)']
  doubles: string[];    // ['안현민(1회)', '장성우(1회)']
  triples: string[];
  steals: string[];     // ['박해민(4회)', '문성주(7회)']
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
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 15000,
  });
  return res.data;
}

// ============ 1. 경기 일정 수집 ============

export async function fetchSchedule(date: string): Promise<GameSchedule[]> {
  const dateParam = date.replace(/-/g, '');
  const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dateParam}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const games: GameSchedule[] = [];

  // 경기 일정 테이블의 각 행을 순회
  $('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    // 경기 셀에서 팀과 스코어 추출
    const gameCell = cells.eq(2).text().trim();    // "KT_6vs5_LG" 또는 "KT_vs_LG"
    const timeCell = cells.eq(1).text().trim();    // "14:00"
    const stadiumCell = cells.eq(7)?.text().trim(); // "잠실"

    // gameId 추출 (링크에서)
    const link = cells.eq(3).find('a').attr('href') || '';
    const gameIdMatch = link.match(/gameId=(\d{8}[A-Z]+\d)/);
    const gameId = gameIdMatch ? gameIdMatch[1] : '';

    if (!gameId) return;

    // 결과 경기: "팀A_숫자vs숫자_팀B"
    const resultMatch = gameCell.match(/(\S+?)_(\d+)vs(\d+)_(\S+)/);
    if (resultMatch) {
      games.push({
        gameId,
        date,
        awayTeam: resultMatch[1],
        homeTeam: resultMatch[4],
        awayScore: parseInt(resultMatch[2]),
        homeScore: parseInt(resultMatch[3]),
        status: 'finished',
        time: timeCell || '18:30',
        stadium: stadiumCell || '',
      });
      return;
    }

    // 예정 경기: "팀A_vs_팀B"
    const scheduledMatch = gameCell.match(/(\S+?)_vs_(\S+)/);
    if (scheduledMatch) {
      games.push({
        gameId,
        date,
        awayTeam: scheduledMatch[1],
        homeTeam: scheduledMatch[2],
        status: 'scheduled',
        time: timeCell || '18:30',
        stadium: stadiumCell || '',
      });
    }
  });

  return games;
}

// ============ 2. 박스스코어 수집 ============

export async function fetchBoxScore(gameId: string): Promise<BoxScoreResult | null> {
  const year = gameId.substring(0, 4);
  const url = `https://www.koreabaseball.com/futures/schedule/BoxScore.aspx?leagueId=1&seriesId=0&seasonId=${year}&gameId=${gameId}`;

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  if (html.includes('이용에 불편을 드려') || html.length < 2000) {
    console.error(`박스스코어를 가져올 수 없습니다: ${gameId}`);
    return null;
  }

  // 날짜 추출
  const dateText = $('body').text().match(/(\d{4})\.(\d{2})\.(\d{2})/);
  const date = dateText ? `${dateText[1]}-${dateText[2]}-${dateText[3]}` : '';

  // 팀 이름 추출
  const teams: string[] = [];
  $('img[alt]').each((_, el) => {
    const alt = $(el).attr('alt') || '';
    if (['KT','LG','SSG','NC','KIA','두산','롯데','삼성','한화','키움'].includes(alt)) {
      if (!teams.includes(alt)) teams.push(alt);
    }
  });
  const awayTeam = teams[0] || '';
  const homeTeam = teams[1] || '';

  // R H E B 스코어 추출
  const rheb: number[][] = [];
  $('table').each((_, table) => {
    const headers = $(table).find('th').map((__, th) => $(th).text().trim()).get();
    if (headers.includes('R') && headers.includes('H') && headers.includes('E')) {
      $(table).find('tbody tr').each((__, row) => {
        const vals = $(row).find('td').map((___, td) => parseInt($(td).text().trim()) || 0).get();
        if (vals.length >= 4) rheb.push(vals);
      });
    }
  });

  const awayScore = rheb[0]?.[rheb[0].length - 4] || 0;
  const homeScore = rheb[1]?.[rheb[1].length - 4] || 0;

  // 타자 기록 테이블 파싱
  function parseBatterTable(tableIndex: number): BatterRecord[] {
    const records: BatterRecord[] = [];
    const tables = $('table');
    let batterTableCount = 0;

    tables.each((_, table) => {
      const caption = $(table).find('caption').text();
      const headerText = $(table).prev().text() || '';

      // "타자 기록" 관련 테이블 찾기
      if (!$(table).text().includes('선수명')) return;
      if (!$(table).text().includes('타수')) return;

      batterTableCount++;
      if (batterTableCount !== tableIndex) return;

      const rows = $(table).find('tbody tr');
      rows.each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 5) return;

        const orderText = cells.eq(0).text().trim();
        const order = parseInt(orderText);
        if (isNaN(order) || order < 1 || order > 9) return;

        const position = cells.eq(1).text().trim();
        const name = cells.eq(2).text().trim();

        // 마지막 5개 셀: 타수, 안타, 타점, 득점, 타율
        const len = cells.length;
        const atBats = parseInt(cells.eq(len - 5).text().trim()) || 0;
        const hits = parseInt(cells.eq(len - 4).text().trim()) || 0;
        const rbi = parseInt(cells.eq(len - 3).text().trim()) || 0;
        const runs = parseInt(cells.eq(len - 2).text().trim()) || 0;
        const avgText = cells.eq(len - 1).text().trim();
        const battingAvg = avgText === '-' ? 0 : parseFloat(avgText) || 0;

        // 이닝별 상세 기록 (중간 셀들)
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

  const awayBatters = parseBatterTable(1);
  const homeBatters = parseBatterTable(2);

  // 경기 이벤트 (홈런, 2루타, 도루 등)
  const events: GameEventSummary = {
    homeRuns: [], doubles: [], triples: [], steals: [],
  };

  $('th').each((_, th) => {
    const label = $(th).text().trim();
    const value = $(th).next('td').text().trim();

    if (label === '홈런' && value) {
      events.homeRuns = value.split(/\s+/);
    } else if (label === '2루타' && value) {
      events.doubles = value.split(/\s+/);
    } else if (label === '3루타' && value) {
      events.triples = value.split(/\s+/);
    } else if (label === '도루' && value) {
      events.steals = value.split(/\s+/);
    }
  });

  return {
    gameId, date, homeTeam, awayTeam,
    homeScore, awayScore,
    homeBatters, awayBatters,
    events,
  };
}

// ============ 3. XP 계산 (타순별) ============

export function calculateBatterXp(
  batter: BatterRecord,
  events: GameEventSummary
): number {
  let xp = 0;

  // 기본 안타 XP: 안타 수 × 10
  xp += batter.hits * 10;

  // 이벤트에서 이 선수의 추가 기록 확인
  // 홈런: 이름이 포함되면 추가 XP (안타 10 + 추가 40 = 총 50)
  for (const hr of events.homeRuns) {
    if (hr.includes(batter.name)) xp += 40;
  }

  // 2루타: 이름이 포함되면 추가 XP (안타 10 + 추가 10 = 총 20)
  for (const d of events.doubles) {
    if (d.includes(batter.name)) xp += 10;
  }

  // 3루타: 안타 10 + 추가 20 = 총 30
  for (const t of events.triples) {
    if (t.includes(batter.name)) xp += 20;
  }

  // 도루: +15
  for (const s of events.steals) {
    if (s.includes(batter.name)) xp += 15;
  }

  // 득점: +10
  xp += batter.runs * 10;

  // 삼진: 상세 기록에서 카운트
  const strikeouts = batter.details.filter((d) => d === '삼진').length;
  xp -= strikeouts * 10;

  // 볼넷: 상세 기록에서 카운트
  const walks = batter.details.filter((d) => d === '4구' || d === '사구').length;
  xp += walks * 10;

  return xp;
}

// ============ 4. 서버 API로 전송 ============

async function sendToServer(
  game: GameSchedule,
  boxScore: BoxScoreResult | null,
  apiUrl: string,
  apiKey: string
): Promise<void> {
  try {
    // 경기 데이터 upsert
    const gameData = {
      gameId: game.gameId,
      date: game.date,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      status: game.status,
      batterRecords: boxScore ? {
        away: boxScore.awayBatters,
        home: boxScore.homeBatters,
      } : undefined,
      events: boxScore?.events,
    };

    await axios.post(`${apiUrl}/api/internal/games`, gameData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    console.log(`  ✅ ${game.awayTeam} vs ${game.homeTeam} 전송 완료`);
  } catch (err: any) {
    console.error(`  ❌ 전송 실패: ${err.message}`);
  }
}

// ============ 5. 메인 실행 ============

async function main() {
  const command = process.argv[2];
  const param = process.argv[3];
  const apiUrl = process.env.API_URL || 'https://beastleague.onrender.com';
  const apiKey = process.env.INTERNAL_API_KEY || '';

  if (command === 'schedule') {
    const date = param || todayKST();
    console.log(`📅 경기 일정 수집: ${date}`);
    const games = await fetchSchedule(date);
    console.log(JSON.stringify(games, null, 2));
    console.log(`총 ${games.length}경기`);

  } else if (command === 'boxscore') {
    if (!param) { console.error('gameId를 입력하세요'); process.exit(1); }
    console.log(`📊 박스스코어 수집: ${param}`);
    const result = await fetchBoxScore(param);
    if (result) {
      console.log(`${result.awayTeam} ${result.awayScore} vs ${result.homeScore} ${result.homeTeam}`);
      console.log(`원정 타자: ${result.awayBatters.length}명`);
      result.awayBatters.forEach((b) => {
        const xp = calculateBatterXp(b, result.events);
        console.log(`  ${b.order}번 ${b.name}: ${b.atBats}타수 ${b.hits}안타 ${b.runs}득점 → XP ${xp}`);
      });
      console.log(`홈 타자: ${result.homeBatters.length}명`);
      result.homeBatters.forEach((b) => {
        const xp = calculateBatterXp(b, result.events);
        console.log(`  ${b.order}번 ${b.name}: ${b.atBats}타수 ${b.hits}안타 ${b.runs}득점 → XP ${xp}`);
      });
    }

  } else if (command === 'daily') {
    const date = param || todayKST();
    console.log(`\n=== ${date} 전체 수집 시작 ===\n`);
    const games = await fetchSchedule(date);
    console.log(`${games.length}경기 발견\n`);

    for (const game of games) {
      console.log(`⚾ ${game.awayTeam} vs ${game.homeTeam} (${game.stadium}) - ${game.status}`);

      if (game.status === 'finished') {
        console.log(`  스코어: ${game.awayScore} - ${game.homeScore}`);
        const box = await fetchBoxScore(game.gameId);

        if (apiKey) {
          await sendToServer(game, box, apiUrl, apiKey);
        }
      }
    }
    console.log(`\n=== 수집 완료 ===`);

  } else {
    console.log('사용법:');
    console.log('  npx ts-node src/kbo-scraper.ts schedule [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts boxscore [gameId]');
    console.log('  npx ts-node src/kbo-scraper.ts daily [YYYY-MM-DD]');
  }
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

main().catch(console.error);
