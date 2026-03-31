/**
 * KBO 경기 데이터 수집기 v8 - 3테이블 구조 대응
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface GameSchedule {
  gameId: string; date: string; homeTeam: string; awayTeam: string;
  homeScore?: number; awayScore?: number;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';
}

export interface BatterRecord {
  order: number; atBats: number; hits: number; rbi: number; runs: number;
  doubles: number; triples: number; homeRuns: number; stolenBases: number;
  walks: number; strikeouts: number; xp: number;
}

export interface BoxScoreResult {
  gameId: string; date: string; homeTeam: string; awayTeam: string;
  homeScore: number; awayScore: number;
  homeBatters: BatterRecord[]; awayBatters: BatterRecord[];
}

async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000,
  });
  return typeof res.data === 'string' ? res.data : String(res.data);
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// ============ 경기 일정 ============
export async function fetchSchedule(date: string): Promise<GameSchedule[]> {
  const dateParam = date.replace(/-/g, '');
  const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dateParam}`;
  const html = await fetchHtml(url);
  const games: GameSchedule[] = [];

  const gameIdRegex = /gameId=(\d{8}[A-Z]{2,6}\d)/g;
  let m: RegExpExecArray | null;
  const allGameIds: string[] = [];
  while ((m = gameIdRegex.exec(html)) !== null) {
    if (!allGameIds.includes(m[1])) allGameIds.push(m[1]);
  }
  console.log(`  gameId ${allGameIds.length}개 발견`);

  const $ = cheerio.load(html);
  const textContent = $('body').text();

  const resultRegex = /(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)\s*(\d+)\s*vs\s*(\d+)\s*(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)/g;
  const results: Array<{ away: string; awayScore: number; homeScore: number; home: string }> = [];
  while ((m = resultRegex.exec(textContent)) !== null) {
    results.push({ away: m[1], awayScore: parseInt(m[2]), homeScore: parseInt(m[3]), home: m[4] });
  }

  const schedRegex = /(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)\s*vs\s*(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)/g;
  const scheduledGames: Array<{ away: string; home: string }> = [];
  while ((m = schedRegex.exec(textContent)) !== null) {
    const exists = results.some(r => r.away === m![1] && r.home === m![2]);
    if (!exists) scheduledGames.push({ away: m[1], home: m[2] });
  }

  let gameIdx = 0;
  for (const r of results) {
    games.push({ gameId: allGameIds[gameIdx] || `${dateParam}GAME${gameIdx}`, date, awayTeam: r.away, homeTeam: r.home, awayScore: r.awayScore, homeScore: r.homeScore, status: 'finished' });
    gameIdx++;
  }
  for (const s of scheduledGames) {
    games.push({ gameId: allGameIds[gameIdx] || `${dateParam}GAME${gameIdx}`, date, awayTeam: s.away, homeTeam: s.home, status: 'scheduled' });
    gameIdx++;
  }
  return games;
}

// ============ 박스스코어 ============
export async function fetchBoxScore(gameId: string): Promise<BoxScoreResult | null> {
  const year = gameId.substring(0, 4);
  const url = `https://www.koreabaseball.com/futures/schedule/BoxScore.aspx?leagueId=1&seriesId=0&seasonId=${year}&gameId=${gameId}`;
  console.log(`  URL: ${url}`);
  const html = await fetchHtml(url);
  console.log(`  HTML 길이: ${html.length}`);

  if (html.includes('이용에 불편을 드려') || html.length < 2000) {
    console.error(`  ❌ 박스스코어를 가져올 수 없습니다`);
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
  $('img').each(function () {
    const alt = $(this).attr('alt') || '';
    if (teamList.includes(alt) && !found.includes(alt)) found.push(alt);
  });
  const awayTeam = found[0] || '';
  const homeTeam = found[1] || '';
  console.log(`  팀: ${awayTeam} vs ${homeTeam}`);

  // 점수 - R 컬럼에서
  let awayScore = 0;
  let homeScore = 0;
  $('table').each(function () {
    const ths: string[] = [];
    $(this).find('th').each(function () { ths.push($(this).text().trim()); });
    if (!ths.includes('R')) return;
    const rIdx = ths.indexOf('R');
    const dataRows: any[] = [];
    $(this).find('tr').each(function () {
      if ($(this).find('td').length > 0) dataRows.push(this);
    });
    if (dataRows.length >= 2) {
      awayScore = parseInt($(dataRows[0]).find('td').eq(rIdx).text()) || 0;
      homeScore = parseInt($(dataRows[1]).find('td').eq(rIdx).text()) || 0;
    }
  });
  console.log(`  스코어: ${awayScore} - ${homeScore}`);

  // 이벤트 (홈런, 2루타, 도루 등)
  const events = { homeRuns: '', doubles: '', steals: '' };
  $('th').each(function () {
    const label = $(this).text().trim();
    const td = $(this).next('td');
    if (!td.length) return;
    const val = td.text().trim();
    if (label === '홈런') events.homeRuns = val;
    else if (label === '2루타') events.doubles = val;
    else if (label === '도루') events.steals = val;
  });

  // ============ 핵심: 타자 기록 파싱 ============
  // HTML에서 "타자 기록" 섹션을 찾아 3개 테이블을 매칭
  // 테이블1: 타순|포지션|선수명, 테이블2: 이닝별기록, 테이블3: 타수|안타|타점|득점|타율

  function parseBatterGroup(sectionHtml: string): BatterRecord[] {
    const s$ = cheerio.load(sectionHtml);
    const tables = s$('table').toArray();
    console.log(`    테이블 수: ${tables.length}`);

    if (tables.length < 3) return [];

    // 테이블1: 타순 정보
    const orders: number[] = [];
    s$(tables[0]).find('tr').each(function () {
      const cells = s$(this).find('td');
      if (cells.length < 1) return;
      const num = parseInt(cells.eq(0).text().trim());
      if (num >= 1 && num <= 9) orders.push(num);
      else if (cells.eq(0).text().trim() === '') return; // skip
    });
    console.log(`    타순 수: ${orders.length}`);

    // 테이블2: 이닝별 기록
    const inningDetails: string[][] = [];
    s$(tables[1]).find('tr').each(function () {
      const cells = s$(this).find('td');
      if (cells.length === 0) return;
      const firstText = cells.eq(0).text().trim();
      if (firstText === 'TOTAL') return;
      const row: string[] = [];
      cells.each(function () { row.push(s$(this).text().trim()); });
      inningDetails.push(row);
    });
    console.log(`    이닝 행 수: ${inningDetails.length}`);

    // 테이블3: 타수|안타|타점|득점|타율
    const stats: Array<{ ab: number; h: number; rbi: number; r: number }> = [];
    s$(tables[2]).find('tr').each(function () {
      const cells = s$(this).find('td');
      if (cells.length < 4) return;
      const ab = parseInt(cells.eq(0).text().trim());
      // TOTAL 행 스킵 (타수가 20 이상)
      if (isNaN(ab) || ab > 20) return;
      stats.push({
        ab: ab,
        h: parseInt(cells.eq(1).text().trim()) || 0,
        rbi: parseInt(cells.eq(2).text().trim()) || 0,
        r: parseInt(cells.eq(3).text().trim()) || 0,
      });
    });
    console.log(`    스탯 행 수: ${stats.length}`);

    // 3개 테이블 합치기 (행 수가 같아야 함)
    const count = Math.min(orders.length, inningDetails.length, stats.length);
    console.log(`    매칭 행 수: ${count}`);

    // 타순별 합산 (대타/대주자 → 같은 타순으로 합산)
    const merged = new Map<number, BatterRecord>();
    for (let o = 1; o <= 9; o++) {
      merged.set(o, {
        order: o, atBats: 0, hits: 0, rbi: 0, runs: 0,
        doubles: 0, triples: 0, homeRuns: 0, stolenBases: 0,
        walks: 0, strikeouts: 0, xp: 0,
      });
    }

    for (let i = 0; i < count; i++) {
      const order = orders[i];
      const b = merged.get(order);
      if (!b) continue;

      // 스탯 합산
      b.atBats += stats[i].ab;
      b.hits += stats[i].h;
      b.rbi += stats[i].rbi;
      b.runs += stats[i].r;

      // 이닝별 디테일에서 이벤트 카운트
      for (const d of inningDetails[i]) {
        if (!d || d === '-' || d === '') continue;
        if (d.includes('홈')) b.homeRuns++;
        if (/2$|2루/.test(d) && d.includes('안') || /^[좌중우]2$/.test(d)) b.doubles++;
        if (/3루/.test(d)) b.triples++;
        if (d.includes('도루')) b.stolenBases++;
        if (d === '4구' || d === '사구') b.walks++;
        if (d.includes('삼진')) b.strikeouts++;
      }
    }

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

    return Array.from(merged.values()).sort((a, bb) => a.order - bb.order);
  }

  // "타자 기록" 텍스트로 섹션 분리
  const fullHtml = $.html();
  const batterSections: string[] = [];
  const regex = /타자\s*기록/g;
  const indices: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(fullHtml)) !== null) {
    indices.push(match.index);
  }
  console.log(`  "타자 기록" 위치: ${indices.length}개`);

  // 투수 기록 위치 찾기
  const pitcherRegex = /투수\s*기록/g;
  const pitcherIndices: number[] = [];
  while ((match = pitcherRegex.exec(fullHtml)) !== null) {
    pitcherIndices.push(match.index);
  }

  // 각 타자 기록 섹션 추출 (타자기록 ~ 투수기록 사이)
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    // 이 타자기록 이후 가장 가까운 투수기록 찾기
    let end = fullHtml.length;
    for (const pi of pitcherIndices) {
      if (pi > start) { end = pi; break; }
    }
    batterSections.push(fullHtml.substring(start, end));
  }

  let awayBatters: BatterRecord[] = [];
  let homeBatters: BatterRecord[] = [];

  if (batterSections.length >= 2) {
    console.log('  원정 타자 파싱...');
    awayBatters = parseBatterGroup(batterSections[0]);
    console.log('  홈 타자 파싱...');
    homeBatters = parseBatterGroup(batterSections[1]);
  } else if (batterSections.length === 1) {
    console.log('  타자 섹션 1개만 발견');
    awayBatters = parseBatterGroup(batterSections[0]);
  } else {
    console.log('  ⚠️ 타자 기록 섹션 없음');
  }

  const awayActive = awayBatters.filter(b => b.atBats > 0 || b.xp !== 0).length;
  const homeActive = homeBatters.filter(b => b.atBats > 0 || b.xp !== 0).length;
  console.log(`  ${awayTeam}: ${awayActive}명 활동, ${homeTeam}: ${homeActive}명 활동`);

  return { gameId, date, homeTeam, awayTeam, homeScore, awayScore, homeBatters, awayBatters };
}

// ============ 서버 전송 ============
async function sendToServer(game: GameSchedule, boxScore: BoxScoreResult | null, apiUrl: string, apiKey: string): Promise<void> {
  try {
    const gameData = {
      gameId: game.gameId, date: game.date,
      homeTeam: game.homeTeam, awayTeam: game.awayTeam,
      homeScore: game.homeScore, awayScore: game.awayScore,
      status: game.status,
      batterRecords: boxScore ? { away: boxScore.awayBatters, home: boxScore.homeBatters } : undefined,
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

// ============ 메인 ============
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
    if (!param) { console.error('gameId를 입력하세요'); process.exit(1); }
    console.log(`📊 박스스코어 수집: ${param}`);
    const result = await fetchBoxScore(param);
    if (result) {
      console.log(`\n${result.awayTeam} ${result.awayScore} vs ${result.homeScore} ${result.homeTeam}`);
      console.log(`\n[${result.awayTeam} 타자]`);
      for (const b of result.awayBatters) {
        console.log(`  ${b.order}번: ${b.atBats}타수 ${b.hits}안타 ${b.rbi}타점 ${b.runs}득점 (홈런${b.homeRuns} 2루타${b.doubles} 도루${b.stolenBases} 삼진${b.strikeouts} 4구${b.walks}) → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
      }
      console.log(`\n[${result.homeTeam} 타자]`);
      for (const b of result.homeBatters) {
        console.log(`  ${b.order}번: ${b.atBats}타수 ${b.hits}안타 ${b.rbi}타점 ${b.runs}득점 (홈런${b.homeRuns} 2루타${b.doubles} 도루${b.stolenBases} 삼진${b.strikeouts} 4구${b.walks}) → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
      }
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
          for (const b of box.awayBatters) {
            if (b.atBats > 0 || b.xp !== 0) console.log(`    원정${b.order}번: ${b.hits}안타 ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
          }
          for (const b of box.homeBatters) {
            if (b.atBats > 0 || b.xp !== 0) console.log(`    홈${b.order}번: ${b.hits}안타 ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
          }
        }
        if (apiKey) { await sendToServer(game, box, apiUrl, apiKey); }
      }
      console.log('');
    }
    console.log(`=== 수집 완료 ===`);

  } else if (command === 'debug-box') {
    const gid = param || '20260329KTLG0';
    const year = gid.substring(0, 4);
    const url = `https://www.koreabaseball.com/futures/schedule/BoxScore.aspx?leagueId=1&seriesId=0&seasonId=${year}&gameId=${gid}`;
    const html = await fetchHtml(url);
    console.log(`HTML 길이: ${html.length}`);
    const idx = html.indexOf('타자 기록');
    if (idx >= 0) {
      console.log(`타자 기록 위치: ${idx}`);
      console.log(html.substring(idx, idx + 3000));
    } else {
      console.log('타자 기록 키워드 없음');
      console.log(html.substring(0, 5000));
    }

  } else {
    console.log('사용법:');
    console.log('  npx ts-node src/kbo-scraper.ts schedule [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts boxscore [gameId]');
    console.log('  npx ts-node src/kbo-scraper.ts daily [YYYY-MM-DD]');
    console.log('  npx ts-node src/kbo-scraper.ts debug-box [gameId]');
  }
}

main().catch(console.error);
