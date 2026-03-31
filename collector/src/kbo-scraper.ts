/**
 * KBO 경기 데이터 수집기 v5
 * - 선수 이름 불필요, 타순 번호만 사용
 * - 대타/대주자 성적 합산
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// ============ 타입 ============

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
  order: number;       // 1~9 타순
  atBats: number;
  hits: number;
  rbi: number;
  runs: number;
  doubles: number;     // 2루타 수
  triples: number;     // 3루타 수
  homeRuns: number;     // 홈런 수
  stolenBases: number;  // 도루 수
  walks: number;        // 볼넷 수
  strikeouts: number;   // 삼진 수
  xp: number;           // 계산된 XP
}

export interface BoxScoreResult {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeBatters: BatterRecord[];   // 9명 (타순별 합산)
  awayBatters: BatterRecord[];   // 9명
}

// ============ HTTP ============

async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 15000,
  });
  return typeof res.data === 'string' ? res.data : String(res.data);
}

// ============ 1. 경기 일정 ============

export async function fetchSchedule(date: string): Promise<GameSchedule[]> {
  const dp = date.replace(/-/g, '');
  const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dp}`;
  const html = await fetchHtml(url);
  const games: GameSchedule[] = [];

  // gameId 추출
  const idRe = /gameId=(\d{8}[A-Z]{2,6}\d)/g;
  const ids: string[] = [];
  let m;
  while ((m = idRe.exec(html)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  console.log(`  gameId ${ids.length}개: ${ids.join(', ')}`);

  const $ = cheerio.load(html);
  const text = $('body').text();
  const tn = 'KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움';

  // 종료 경기
  const rRe = new RegExp(`(${tn})\\s*(\\d+)\\s*vs\\s*(\\d+)\\s*(${tn})`, 'g');
  const results: Array<{ aw: string; as: number; hs: number; hm: string }> = [];
  while ((m = rRe.exec(text)) !== null) {
    results.push({ aw: m[1], as: +m[2], hs: +m[3], hm: m[4] });
  }

  // 예정 경기
  const sRe = new RegExp(`(${tn})\\s*vs\\s*(${tn})`, 'g');
  const sched: Array<{ aw: string; hm: string }> = [];
  while ((m = sRe.exec(text)) !== null) {
    if (!results.some(r => r.aw === m![1] && r.hm === m![2])) {
      sched.push({ aw: m[1], hm: m[2] });
    }
  }

  let i = 0;
  for (const r of results) {
    games.push({ gameId: ids[i] || `${dp}G${i}`, date, awayTeam: r.aw, homeTeam: r.hm, awayScore: r.as, homeScore: r.hs, status: 'finished' });
    i++;
  }
  for (const s of sched) {
    games.push({ gameId: ids[i] || `${dp}G${i}`, date, awayTeam: s.aw, homeTeam: s.hm, status: 'scheduled' });
    i++;
  }
  console.log(`  종료: ${results.length}, 예정: ${sched.length}`);
  return games;
}

// ============ 2. 박스스코어 ============

// 이닝 상세에서 이벤트 카운트
function parseDetail(d: string): { hit: boolean; double: boolean; triple: boolean; hr: boolean; walk: boolean; k: boolean } {
  const t = d.trim();
  if (!t) return { hit: false, double: false, triple: false, hr: false, walk: false, k: false };

  const hr = t.includes('홈');
  const triple = !hr && (t === '3' || t.includes('3루'));  // 3루타는 드묾
  const double = !hr && !triple && t.includes('2') && t.includes('안') || t.match(/^[좌중우]2$/) !== null;
  const hit = !hr && !double && !triple && t.includes('안');
  const walk = t === '4구' || t === '사구';
  const k = t === '삼진';

  return { hit: hit || double || triple || hr, double, triple, hr, walk, k };
}

export async function fetchBoxScore(gameId: string): Promise<BoxScoreResult | null> {
  const year = gameId.substring(0, 4);
  const url = `https://www.koreabaseball.com/futures/schedule/BoxScore.aspx?leagueId=1&seriesId=0&seasonId=${year}&gameId=${gameId}`;
  const html = await fetchHtml(url);

  if (html.includes('이용에 불편을 드려') || html.length < 2000) {
    console.error(`  ❌ 가져올 수 없음: ${gameId}`);
    return null;
  }

  const $ = cheerio.load(html);
  const bodyText = $('body').text();

  // 날짜
  const dm = bodyText.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  const date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '';

  // 팀
  const teamList = ['KT','LG','SSG','NC','KIA','두산','롯데','삼성','한화','키움'];
  const found: string[] = [];
  $('img').each((_, el) => {
    const alt = $(el).attr('alt') || '';
    if (teamList.includes(alt) && !found.includes(alt)) found.push(alt);
  });
  const awayTeam = found[0] || '';
  const homeTeam = found[1] || '';

  // 스코어
  let awayScore = 0, homeScore = 0;
  $('table').each((_, tbl) => {
    const ths = $(tbl).find('th').map((__, th) => $(th).text().trim()).get();
    if (!ths.includes('R')) return;
    const rIdx = ths.indexOf('R');
    const rows = $(tbl).find('tr').filter((__, r) => $(r).find('td').length > 0);
    if (rows.length >= 2) {
      awayScore = parseInt($(rows[0]).find('td').eq(rIdx).text()) || 0;
      homeScore = parseInt($(rows[1]).find('td').eq(rIdx).text()) || 0;
    }
  });

  // === 타자 기록 파싱 ===
  // HTML을 "타자 기록" 기준으로 분할
  const fullHtml = $.html();
  const sections = fullHtml.split(/타자\s*기록/);
  console.log(`  타자 섹션: ${sections.length - 1}개`);

  function parseBatterSection(sectionHtml: string): BatterRecord[] {
    const s$ = cheerio.load(sectionHtml);
    const tables = s$('table').toArray();

    if (tables.length < 3) {
      console.log(`    테이블 ${tables.length}개 (최소 3개 필요)`);
      return [];
    }

    // 테이블 0: 타순 번호 + 포지션 + 이름
    const orderList: number[] = [];
    s$(tables[0]).find('tr').each((_, row) => {
      const cells = s$(row).find('td');
      if (cells.length < 2) return;
      const num = parseInt(cells.eq(0).text().trim());
      if (num >= 1 && num <= 9) {
        orderList.push(num);
      }
    });

    // 테이블 1: 이닝별 상세
    const detailRows: string[][] = [];
    s$(tables[1]).find('tr').each((_, row) => {
      const cells = s$(row).find('td');
      if (cells.length === 0) return;
      const text = cells.eq(0).text().trim();
      if (text === 'TOTAL') return;
      const rowData: string[] = [];
      cells.each((__, c) => rowData.push(s$(c).text().trim()));
      detailRows.push(rowData);
    });

    // 테이블 2: 타수|안타|타점|득점|타율
    const statRows: Array<{ ab: number; h: number; rbi: number; r: number }> = [];
    s$(tables[2]).find('tr').each((_, row) => {
      const cells = s$(row).find('td');
      if (cells.length < 5) return;
      const ab = parseInt(cells.eq(0).text().trim());
      if (isNaN(ab)) return;
      // TOTAL 행 제외 (타수가 30 이상이면 합계)
      if (ab > 20) return;
      statRows.push({
        ab,
        h: parseInt(cells.eq(1).text().trim()) || 0,
        rbi: parseInt(cells.eq(2).text().trim()) || 0,
        r: parseInt(cells.eq(3).text().trim()) || 0,
      });
    });

    console.log(`    타순: ${orderList.length}명, 상세: ${detailRows.length}행, 성적: ${statRows.length}행`);

    // 행별로 매핑 (orderList[i] = i번째 행의 타순)
    const rawRecords: Array<{
      order: number; ab: number; h: number; rbi: number; r: number; details: string[];
    }> = [];

    const count = Math.min(orderList.length, statRows.length);
    for (let i = 0; i < count; i++) {
      rawRecords.push({
        order: orderList[i],
        ab: statRows[i].ab,
        h: statRows[i].h,
        rbi: statRows[i].rbi,
        r: statRows[i].r,
        details: detailRows[i] || [],
      });
    }

    // 같은 타순 합산 → 9명으로
    const merged = new Map<number, BatterRecord>();
    for (let o = 1; o <= 9; o++) {
      merged.set(o, {
        order: o, atBats: 0, hits: 0, rbi: 0, runs: 0,
        doubles: 0, triples: 0, homeRuns: 0, stolenBases: 0,
        walks: 0, strikeouts: 0, xp: 0,
      });
    }

    for (const rec of rawRecords) {
      const b = merged.get(rec.order);
      if (!b) continue;

      b.atBats += rec.ab;
      b.hits += rec.h;
      b.rbi += rec.rbi;
      b.runs += rec.r;

      // 이닝별 상세에서 이벤트 카운트
      for (const d of rec.details) {
        if (!d) continue;
        if (d.includes('홈')) { b.homeRuns++; }
        else if (/^[좌중우]2$/.test(d) || d.includes('2루')) { b.doubles++; }
        else if (d.includes('3루')) { b.triples++; }

        if (d === '4구' || d === '사구') { b.walks++; }
        if (d === '삼진') { b.strikeouts++; }
      }
    }

    // XP 계산
    for (const [, b] of merged) {
      let xp = 0;
      // 단타 = 총 안타 - 2루타 - 3루타 - 홈런
      const singles = b.hits - b.doubles - b.triples - b.homeRuns;
      xp += singles * 10;       // 단타 +10
      xp += b.doubles * 20;     // 2루타 +20
      xp += b.triples * 30;     // 3루타 +30
      xp += b.homeRuns * 50;    // 홈런 +50
      xp += b.walks * 10;       // 볼넷 +10
      xp += b.runs * 10;        // 득점 +10
      xp -= b.strikeouts * 10;  // 삼진 -10
      // 도루는 이닝 상세에서 안 나옴 → 이벤트 테이블에서 처리 필요
      b.xp = xp;
    }

    return Array.from(merged.values()).sort((a, b) => a.order - b.order);
  }

  let awayBatters: BatterRecord[] = [];
  let homeBatters: BatterRecord[] = [];

  if (sections.length >= 3) {
    const awSec = sections[1].split(/투수\s*기록/)[0];
    const hmSec = sections[2].split(/투수\s*기록/)[0];
    console.log(`  원정 섹션 파싱...`);
    awayBatters = parseBatterSection(awSec);
    console.log(`  홈 섹션 파싱...`);
    homeBatters = parseBatterSection(hmSec);
  }

  // 도루: 이벤트 테이블에서 추가 (타순 매핑은 이름 없이 불가 → 일단 스킵)
  // TODO: 도루는 이름 테이블과 매핑해서 타순에 추가

  console.log(`  ${awayTeam}: ${awayBatters.filter(b => b.xp !== 0).length}명 XP 발생`);
  console.log(`  ${homeTeam}: ${homeBatters.filter(b => b.xp !== 0).length}명 XP 발생`);

  return { gameId, date, homeTeam, awayTeam, homeScore, awayScore, homeBatters, awayBatters };
}

// ============ 3. 서버 전송 ============

async function sendToServer(game: GameSchedule, box: BoxScoreResult | null, apiUrl: string, apiKey: string) {
  try {
    await axios.post(`${apiUrl}/api/internal/games`, {
      gameId: game.gameId, date: game.date,
      homeTeam: game.homeTeam, awayTeam: game.awayTeam,
      homeScore: game.homeScore, awayScore: game.awayScore,
      status: game.status,
      batterRecords: box ? { away: box.awayBatters, home: box.homeBatters } : undefined,
    }, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      timeout: 30000,
    });
    console.log(`  ✅ 전송 완료`);
  } catch (err: any) {
    console.error(`  ❌ 전송 실패: ${err.response?.data || err.message}`);
  }
}

// ============ 4. 메인 ============

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const cmd = process.argv[2];
  const param = process.argv[3];
  const apiUrl = process.env.API_URL || 'https://beastleague.onrender.com';
  const apiKey = process.env.INTERNAL_API_KEY || '';

  if (cmd === 'schedule') {
    const date = param || todayKST();
    console.log(`📅 일정: ${date}`);
    const games = await fetchSchedule(date);
    games.forEach(g => console.log(`  ⚾ ${g.awayTeam} ${g.awayScore??''} vs ${g.homeScore??''} ${g.homeTeam} [${g.status}] ${g.gameId}`));

  } else if (cmd === 'boxscore') {
    if (!param) { console.error('gameId 필요'); process.exit(1); }
    console.log(`📊 박스스코어: ${param}\n`);
    const r = await fetchBoxScore(param);
    if (r) {
      console.log(`\n${r.awayTeam} ${r.awayScore} vs ${r.homeScore} ${r.homeTeam}\n`);
      console.log(`[${r.awayTeam}]`);
      r.awayBatters.forEach(b => {
        console.log(`  ${b.order}번 타자: ${b.atBats}타수 ${b.hits}안타 (홈런${b.homeRuns} 2루타${b.doubles}) ${b.runs}득점 ${b.walks}볼넷 ${b.strikeouts}삼진 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
      });
      console.log(`\n[${r.homeTeam}]`);
      r.homeBatters.forEach(b => {
        console.log(`  ${b.order}번 타자: ${b.atBats}타수 ${b.hits}안타 (홈런${b.homeRuns} 2루타${b.doubles}) ${b.runs}득점 ${b.walks}볼넷 ${b.strikeouts}삼진 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
      });
    }

  } else if (cmd === 'daily') {
    const date = param || todayKST();
    console.log(`\n=== ${date} 전체 수집 ===\n`);
    const games = await fetchSchedule(date);
    console.log(`${games.length}경기\n`);
    for (const g of games) {
      console.log(`⚾ ${g.awayTeam} vs ${g.homeTeam} [${g.status}]`);
      if (g.status === 'finished') {
        console.log(`  ${g.awayScore} - ${g.homeScore}`);
        const box = await fetchBoxScore(g.gameId);
        if (box) {
          console.log(`  [${g.awayTeam}]`);
          box.awayBatters.forEach(b => {
            if (b.atBats > 0 || b.walks > 0) {
              console.log(`    ${b.order}번: ${b.hits}안타 ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
            }
          });
          console.log(`  [${g.homeTeam}]`);
          box.homeBatters.forEach(b => {
            if (b.atBats > 0 || b.walks > 0) {
              console.log(`    ${b.order}번: ${b.hits}안타 ${b.runs}득점 → XP ${b.xp > 0 ? '+' : ''}${b.xp}`);
            }
          });
        }
        if (apiKey) await sendToServer(g, box, apiUrl, apiKey);
        else console.log(`  ⚠️ API_KEY 없음`);
      }
      console.log('');
    }
    console.log(`=== 완료 ===`);
  }
}

main().catch(console.error);
