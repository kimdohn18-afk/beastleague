/**
 * autoCollect.ts — KBO 박스스코어 자동 수집 → 서버 전송
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const API_URL = process.env.API_URL || 'https://beastleague.onrender.com';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';

const CODE2_TO_TEAM: Record<string, string> = {
  'HT': 'KIA', 'SS': '삼성', 'LG': 'LG', 'OB': '두산',
  'KT': 'KT', 'SK': 'SSG', 'HH': '한화', 'LT': '롯데',
  'NC': 'NC', 'WO': '키움',
};

function teamFromGameId(gameId: string): { away: string; home: string } {
  const part = gameId.replace(/^\d{8}/, '').replace(/\d$/, '');
  return {
    away: CODE2_TO_TEAM[part.slice(0, 2)] || part.slice(0, 2),
    home: CODE2_TO_TEAM[part.slice(2)] || part.slice(2),
  };
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// ─── 경기 목록 ───
async function fetchGameIds(date: string): Promise<string[]> {
  const compact = date.replace(/-/g, '');
  const { data: html } = await axios.get(
    'https://www.koreabaseball.com/Schedule/Schedule.aspx',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  const $ = cheerio.load(html);
  const ids: string[] = [];

  $('a[href*="gameId="]').each(function (this: cheerio.Element) {
    const href = $(this).attr('href') || '';
    const m = href.match(/gameId=(\d{8}\w+)/);
    if (m && m[1].startsWith(compact) && !ids.includes(m[1])) {
      ids.push(m[1]);
    }
  });

  console.log(`📅 ${date}: ${ids.length}개 경기 발견`);
  return ids;
}

// ─── 타입 ───
interface BatterRecord {
  order: number;
  position: string;
  name: string;
  atBats: number;
  hits: number;
  rbi: number;
  runs: number;
  avg: string;
  homeRuns: number;
  doubles: number;
  triples: number;
  stolenBases: number;
  stolenBaseFails: number;
  walks: number;
  walkOff: boolean;
}

interface GameResult {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  startTime: string;
  batterRecords: { away: BatterRecord[]; home: BatterRecord[] };
  events: Array<{ type: string; detail: string }>;
}

// ─── 박스스코어 파싱 ───
async function fetchBoxScore(gameId: string, date: string): Promise<GameResult | null> {
  const compact = date.replace(/-/g, '');
  const url = `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compact}&gameId=${gameId}&section=REVIEW`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.koreabaseball.com/Schedule/Schedule.aspx',
      },
    });
    const $ = cheerio.load(html);

    // 이벤트 파싱
    const events: Array<{ type: string; detail: string }> = [];
    const hrNames: string[] = [];
    const doubleNames: string[] = [];
    const tripleNames: string[] = [];
    const sbNames: string[] = [];
    const sbFailNames: string[] = [];
    let walkOffName = '';

    $('#tblEtc tr').each(function (this: cheerio.Element) {
      const th = $(this).find('th').text().trim();
      const td = $(this).find('td').text().trim();
      if (!th || !td) return;

      if (th === '홈런') {
        const matches = td.match(/([가-힣A-Za-z]+)\d*호/g);
        if (matches) matches.forEach(m => hrNames.push(m.replace(/\d+호/, '')));
        events.push({ type: 'HR', detail: td });
      }
      if (th === '2루타') {
        td.split(/[,\s]+/).forEach(s => {
          const n = s.replace(/\(.*?\)/g, '').trim();
          if (n) doubleNames.push(n);
        });
        events.push({ type: 'DOUBLE', detail: td });
      }
      if (th === '3루타') {
        td.split(/[,\s]+/).forEach(s => {
          const n = s.replace(/\(.*?\)/g, '').trim();
          if (n) tripleNames.push(n);
        });
        events.push({ type: 'TRIPLE', detail: td });
      }
      if (th === '도루') {
        td.split(/[,\s]+/).forEach(s => {
          const n = s.replace(/\(.*?\)/g, '').trim();
          if (n) sbNames.push(n);
        });
        events.push({ type: 'SB', detail: td });
      }
      if (th === '도루자' || th === '도루실패') {
        td.split(/[,\s]+/).forEach(s => {
          const n = s.replace(/\(.*?\)/g, '').trim();
          if (n) sbFailNames.push(n);
        });
        events.push({ type: 'SB_FAIL', detail: td });
      }
      if (th === '결승타') {
        const inningMatch = td.match(/(\d+)회/);
        if (inningMatch && parseInt(inningMatch[1]) >= 9) {
          const nameMatch2 = td.match(/^([가-힣A-Za-z]+)/);
          if (nameMatch2) walkOffName = nameMatch2[1];
        }
        events.push({ type: 'WALK_OFF', detail: td });
      }
    });

    // 이름 매칭
    function nameMatch(playerName: string, nameList: string[]): number {
      return nameList.filter(n => playerName.includes(n) || n.includes(playerName)).length;
    }

    // 타자 테이블 파싱
    function parseBatters(tableHtml: string): BatterRecord[] {
      const t$ = cheerio.load(tableHtml);
      const records: BatterRecord[] = [];
      let currentOrder = 0;

      t$('tbody tr').each(function (this: cheerio.Element) {
        const tds = t$(this).find('td');
        if (tds.length < 5) return;

        const texts: string[] = [];
        tds.each(function (this: cheerio.Element) {
          texts.push(t$(this).text().trim());
        });

        if (texts.join('').includes('TOTAL')) return;

        const orderText = texts[0];
        const position = texts[1] || '';
        const name = texts[2] || '';

        if (!name) return;

        if (/^\d+$/.test(orderText)) {
          currentOrder = parseInt(orderText);
        }

        if (records.some(r => r.order === currentOrder)) return;
        if (currentOrder === 0) return;

        const statsStart = texts.length - 5;
        const atBats = parseInt(texts[statsStart]) || 0;
        const hits = parseInt(texts[statsStart + 1]) || 0;
        const rbi = parseInt(texts[statsStart + 2]) || 0;
        const runs = parseInt(texts[statsStart + 3]) || 0;
        const avg = texts[statsStart + 4] || '0.000';

        let walks = 0;
        for (let i = 3; i < statsStart; i++) {
          if (texts[i] === '4구') walks++;
        }

        records.push({
          order: currentOrder,
          position,
          name,
          atBats,
          hits,
          rbi,
          runs,
          avg,
          homeRuns: nameMatch(name, hrNames),
          doubles: nameMatch(name, doubleNames),
          triples: nameMatch(name, tripleNames),
          stolenBases: nameMatch(name, sbNames),
          stolenBaseFails: nameMatch(name, sbFailNames),
          walks,
          walkOff: walkOffName !== '' && name.includes(walkOffName),
        });
      });

      return records;
    }

    // 타자 테이블 찾기
    const batterTableHtmls: string[] = [];
    $('table').each(function (this: cheerio.Element) {
      const caption = $(this).find('caption').text();
      const prevText = $(this).prev().text();
      if (caption.includes('타자') || prevText.includes('타자 기록')) {
        batterTableHtmls.push($.html(this));
      }
    });

    const awayBatters = batterTableHtmls.length >= 1 ? parseBatters(batterTableHtmls[0]) : [];
    const homeBatters = batterTableHtmls.length >= 2 ? parseBatters(batterTableHtmls[1]) : [];

    // 팀 & 점수
    const teams = teamFromGameId(gameId);
    let awayScore = 0;
    let homeScore = 0;

    $('table').each(function (this: cheerio.Element) {
      const text = $(this).text();
      if (text.includes('R') && text.includes('H') && text.includes('E') && text.includes('B')) {
        const rows = $(this).find('tr');
        if (rows.length >= 2) {
          const r0 = $(rows.eq(0)).find('td').first().text().trim();
          const r1 = $(rows.eq(1)).find('td').first().text().trim();
          if (/^\d+$/.test(r0)) awayScore = parseInt(r0);
          if (/^\d+$/.test(r1)) homeScore = parseInt(r1);
        }
      }
    });

    console.log(`  ⚾ ${gameId}: ${teams.away} ${awayScore} vs ${teams.home} ${homeScore} | 원정${awayBatters.length}명 홈${homeBatters.length}명`);

    [...awayBatters, ...homeBatters].forEach(b => {
      const extras: string[] = [];
      if (b.homeRuns > 0) extras.push(`HR:${b.homeRuns}`);
      if (b.doubles > 0) extras.push(`2B:${b.doubles}`);
      if (b.triples > 0) extras.push(`3B:${b.triples}`);
      if (b.stolenBases > 0) extras.push(`SB:${b.stolenBases}`);
      if (b.walkOff) extras.push('끝내기!');
      if (extras.length > 0) {
        console.log(`     ${b.order}번 ${b.name}: ${b.hits}안타 ${b.rbi}타점 ${extras.join(' ')}`);
      }
    });

    return {
      gameId,
      date,
      homeTeam: teams.home,
      awayTeam: teams.away,
      homeScore,
      awayScore,
      status: 'finished',
      startTime: '18:30',
      batterRecords: { away: awayBatters, home: homeBatters },
      events,
    };
  } catch (err: any) {
    console.error(`  ❌ ${gameId} 파싱 실패:`, err.message);
    return null;
  }
}

// ─── 서버 전송 ───
async function sendToServer(games: GameResult[]): Promise<boolean> {
  if (!INTERNAL_KEY) {
    console.log('⚠️  INTERNAL_API_KEY 없음 — 전송 스킵 (테스트 모드)');
    console.log('\n📋 파싱 결과 JSON:');
    console.log(JSON.stringify(games, null, 2));
    return false;
  }

  try {
    const res = await axios.post(`${API_URL}/internal/games`, games, {
      headers: { 'x-internal-key': INTERNAL_KEY, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    console.log('✅ 서버 전송 완료:', JSON.stringify(res.data, null, 2));
    return true;
  } catch (err: any) {
    console.error('❌ 서버 전송 실패:', err.response?.data || err.message);
    return false;
  }
}

// ─── 정산 ───
async function settleGames(gameIds: string[]): Promise<void> {
  for (const id of gameIds) {
    try {
      const res = await axios.post(`${API_URL}/internal/games/${id}/settle`, {}, {
        headers: { 'x-internal-key': INTERNAL_KEY },
        timeout: 30000,
      });
      console.log(`  ✅ ${id} 정산: ${res.data.settledCount}건`);
    } catch (err: any) {
      console.error(`  ❌ ${id} 정산 실패:`, err.response?.data || err.message);
    }
  }
}

// ─── 메인 ───
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let date = todayKST();
  const doSettle = args.includes('--settle');
  const dateIdx = args.indexOf('--date');
  if (dateIdx !== -1 && args[dateIdx + 1]) date = args[dateIdx + 1];

  console.log(`\n🐾 비스트리그 자동 수집기`);
  console.log(`📅 ${date} | 서버: ${API_URL} | 정산: ${doSettle ? 'YES' : 'NO'}\n`);

  const gameIds = await fetchGameIds(date);
  if (gameIds.length === 0) {
    console.log('⚠️  경기 없음');
    return;
  }

  const games: GameResult[] = [];
  for (const id of gameIds) {
    const g = await fetchBoxScore(id, date);
    if (g && (g.batterRecords.away.length > 0 || g.batterRecords.home.length > 0)) {
      games.push(g);
    }
    await new Promise<void>(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n📊 ${games.length}/${gameIds.length} 경기 파싱 성공`);

  if (games.length === 0) {
    console.log('⚠️  파싱 실패 — KBO 페이지가 JS 렌더링 필요할 수 있음');
    process.exit(1);
  }

  const sent = await sendToServer(games);
  if (sent && doSettle) {
    console.log('\n⚡ 정산 시작...');
    await settleGames(games.map(g => g.gameId));
  }

  console.log('\n🎉 완료!');
}

main().catch(err => {
  console.error('💥 오류:', err);
  process.exit(1);
});
