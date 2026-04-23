/**
 * autoCollect.ts — KBO 공식 페이지에서 타순별 기록을 자동 수집하여
 * 비스트리그 서버 /internal/games API로 전송하는 스크립트
 *
 * 사용법:
 *   npx ts-node src/tools/autoCollect.ts                  # 오늘 날짜
 *   npx ts-node src/tools/autoCollect.ts --date 2026-04-24
 *   npx ts-node src/tools/autoCollect.ts --date 2026-04-24 --settle  # 수집 + 정산
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// ─── 설정 ───
const API_URL = process.env.API_URL || 'https://beastleague.onrender.com';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';
const KBO_BASE = 'https://www.koreabaseball.com';

// ─── 팀 코드 매핑 (KBO 내부코드 → 비스트리그 코드) ───
const TEAM_MAP: Record<string, string> = {
  'HT': 'KIA', '기아': 'KIA', 'KIA': 'KIA',
  'SS': '삼성', '삼성': '삼성',
  'LG': 'LG',
  'OB': '두산', '두산': '두산',
  'KT': 'KT',
  'SK': 'SSG', 'SSG': 'SSG',
  'HH': '한화', '한화': '한화',
  'LT': '롯데', '롯데': '롯데',
  'NC': 'NC',
  'WO': '키움', '키움': '키움',
};

// ─── KBO 팀명 → 비스트리그 TeamCode ───
function toTeamCode(kboName: string): string {
  // "한화 이글스" → "한화", "LG 트윈스" → "LG"
  const short = kboName.replace(/\s*(이글스|트윈스|자이언츠|타이거즈|라이온즈|베어스|위즈|랜더스|다이노스|히어로즈).*/, '').trim();
  return TEAM_MAP[short] || short;
}

// ─── 날짜 유틸 ───
function todayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

function dateToCompact(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

// ─── 1단계: 해당 날짜의 경기 목록 가져오기 ───
async function fetchGameList(date: string): Promise<string[]> {
  const compact = dateToCompact(date);
  const url = `${KBO_BASE}/Schedule/GameCenter/Main.aspx?gameDate=${compact}`;

  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const $ = cheerio.load(html);

  const gameIds: string[] = [];

  // 게임센터 링크에서 gameId 추출
  $('a[href*="gameId="]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/gameId=(\d+[A-Z]+\d*)/);
    if (match && !gameIds.includes(match[1])) {
      gameIds.push(match[1]);
    }
  });

  // 링크가 없으면 스케줄 테이블에서 추출 시도
  if (gameIds.length === 0) {
    $('td a[href*="gameId"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/gameId=(\d+\w+)/);
      if (match && !gameIds.includes(match[1])) {
        gameIds.push(match[1]);
      }
    });
  }

  console.log(`📅 ${date}: ${gameIds.length}개 경기 발견`);
  return gameIds;
}

// ─── 2단계: 개별 경기 박스스코어 파싱 ───
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
  batterRecords: {
    away: BatterRecord[];
    home: BatterRecord[];
  };
  events: Array<{ type: string; detail: string }>;
}

async function fetchGameDetail(gameId: string, date: string): Promise<GameResult | null> {
  const compact = dateToCompact(date);
  const url = `${KBO_BASE}/Schedule/GameCenter/Main.aspx?gameDate=${compact}&gameId=${gameId}&section=REVIEW`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });
    const $ = cheerio.load(html);

    // ─── 팀명 추출 ───
    const teamHeaders = $('h6, .team-name, caption').text();
    // 상세기록표에서 이벤트 추출
    const eventTable = $('#tblEtc');
    const events: Array<{ type: string; detail: string }> = [];
    const hrPlayers: string[] = [];
    const doublePlayers: string[] = [];
    const triplePlayers: string[] = [];
    const sbPlayers: string[] = [];
    const sbFailPlayers: string[] = [];
    let walkOffPlayer = '';

    eventTable.find('tr').each((_, row) => {
      const th = $(row).find('th').text().trim();
      const td = $(row).find('td').text().trim();

      if (th === '홈런') {
        // "송찬의1호(2회2점 왕옌청)" → 선수명 추출
        const matches = td.match(/([가-힣a-zA-Z]+)\d*호/g);
        if (matches) matches.forEach(m => {
          const name = m.replace(/\d+호/, '');
          hrPlayers.push(name);
        });
        events.push({ type: 'HR', detail: td });
      }
      if (th === '2루타') {
        const names = td.split(/[,\s]+/).map(s => s.replace(/\(.*\)/, '').trim()).filter(Boolean);
        doublePlayers.push(...names);
        events.push({ type: 'DOUBLE', detail: td });
      }
      if (th === '3루타') {
        const names = td.split(/[,\s]+/).map(s => s.replace(/\(.*\)/, '').trim()).filter(Boolean);
        triplePlayers.push(...names);
        events.push({ type: 'TRIPLE', detail: td });
      }
      if (th === '도루') {
        const names = td.split(/[,\s]+/).map(s => s.replace(/\(.*\)/, '').trim()).filter(Boolean);
        sbPlayers.push(...names);
        events.push({ type: 'SB', detail: td });
      }
      if (th === '도루자' || th === '도루실패') {
        const names = td.split(/[,\s]+/).map(s => s.replace(/\(.*\)/, '').trim()).filter(Boolean);
        sbFailPlayers.push(...names);
        events.push({ type: 'SB_FAIL', detail: td });
      }
      if (th === '결승타') {
        // 끝내기 판별: 9회말 이후 결승타
        if (td.includes('회') && parseInt(td.match(/(\d+)회/)?.[1] || '0') >= 9) {
          const nameMatch = td.match(/^([가-힣a-zA-Z]+)/);
          if (nameMatch) walkOffPlayer = nameMatch[1];
        }
        events.push({ type: 'WALK_OFF', detail: td });
      }
    });

    // ─── 타자 기록 테이블 파싱 ───
    const batterTables = $('table').filter((_, el) => {
      const caption = $(el).find('caption').text();
      const prevH = $(el).prev('h6, h5').text();
      return caption.includes('타자') || prevH.includes('타자');
    });

    function parseBatterTable(table: cheerio.Cheerio<cheerio.Element>): BatterRecord[] {
      const records: BatterRecord[] = [];
      const rows = table.find('tbody tr').not(':last-child'); // TOTAL 행 제외
      let currentOrder = 0;

      rows.each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 5) return;

        const orderText = $(cells[0]).text().trim();
        const position = $(cells[1]).text().trim();
        const name = $(cells[2]).text().trim();

        if (!name) return;

        // 타순 번호: 숫자면 새 타순, '타'/'주' 등이면 대타/대주자 (같은 타순)
        if (/^\d+$/.test(orderText)) {
          currentOrder = parseInt(orderText);
        }
        // 대타/대주자는 해당 타순의 기록에 포함되므로 스킵하지 않고
        // 첫 출전 선수의 기록만 사용 (이미 같은 order가 있으면 스킵)
        if (records.some(r => r.order === currentOrder)) return;

        // 타수, 안타, 타점, 득점, 타율 (마지막 5개 열)
        const statCells = cells.toArray().slice(-5);
        const atBats = parseInt($(statCells[0]).text().trim()) || 0;
        const hits = parseInt($(statCells[1]).text().trim()) || 0;
        const rbi = parseInt($(statCells[2]).text().trim()) || 0;
        const runs = parseInt($(statCells[3]).text().trim()) || 0;
        const avg = $(statCells[4]).text().trim();

        records.push({
          order: currentOrder,
          position,
          name,
          atBats,
          hits,
          rbi,
          runs,
          avg,
          homeRuns: hrPlayers.filter(p => name.includes(p) || p.includes(name)).length,
          doubles: doublePlayers.filter(p => name.includes(p) || p.includes(name)).length,
          triples: triplePlayers.filter(p => name.includes(p) || p.includes(name)).length,
          stolenBases: sbPlayers.filter(p => name.includes(p) || p.includes(name)).length,
          stolenBaseFails: sbFailPlayers.filter(p => name.includes(p) || p.includes(name)).length,
          walks: 0, // 4사구는 이닝별 기록에서 카운트
          walkOff: name.includes(walkOffPlayer) && walkOffPlayer !== '',
        });
      });

      // 4사구(볼넷) 카운트: 이닝 기록에서 '4구' 찾기
      const inningCells = table.find('tbody tr').not(':last-child');
      inningCells.each((rowIdx, row) => {
        const inningTds = $(row).find('td');
        // 이닝별 결과 셀에서 '4구' 카운트
        let walkCount = 0;
        inningTds.each((_, td) => {
          const text = $(td).text().trim();
          if (text === '4구') walkCount++;
        });
        if (records[rowIdx]) {
          records[rowIdx].walks = walkCount;
        }
      });

      return records;
    }

    // 원정팀이 먼저, 홈팀이 나중
    const awayBatters = batterTables.length >= 1 ? parseBatterTable($(batterTables[0])) : [];
    const homeBatters = batterTables.length >= 2 ? parseBatterTable($(batterTables[1])) : [];

    // ─── 점수 추출 ───
    const scoreTable = $('table').filter((_, el) => {
      return $(el).find('th, td').text().includes('R') && $(el).find('th, td').text().includes('H');
    }).first();

    const scoreCells = scoreTable.find('tr').last().find('td');
    // R H E B 순서에서 R만 추출
    const rCells = scoreTable.find('td:first-child');

    // 간단하게: 상세기록표 위의 스코어 정보에서 추출
    let homeScore = 0, awayScore = 0;
    const scoreRows = $('table').filter((_, el) => {
      const text = $(el).text();
      return text.includes('R') && text.includes('H') && text.includes('E') && text.includes('B');
    }).find('tr');

    if (scoreRows.length >= 2) {
      // R 열 (첫 번째 숫자 열)
      const rIdx = 0; // R H E B 순
      const awayRCells = $(scoreRows[0]).find('td');
      const homeRCells = $(scoreRows[1]).find('td');
      awayScore = parseInt($(awayRCells[rIdx]).text().trim()) || 0;
      homeScore = parseInt($(homeRCells[rIdx]).text().trim()) || 0;
    }

    // ─── 팀명 추출 (h6 태그에서) ───
    const h6Texts: string[] = [];
    $('h6').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes('타자')) h6Texts.push(text);
    });

    let awayTeam = '', homeTeam = '';
    if (h6Texts.length >= 2) {
      awayTeam = toTeamCode(h6Texts[0].replace('타자 기록', '').trim());
      homeTeam = toTeamCode(h6Texts[1].replace('타자 기록', '').trim());
    } else {
      // gameId에서 추출: 20260422HHLG0 → HH=원정, LG=홈
      const teamPart = gameId.replace(/^\d{8}/, '').replace(/\d$/, '');
      const awayCode = teamPart.slice(0, 2);
      const homeCode = teamPart.slice(2);
      awayTeam = TEAM_MAP[awayCode] || awayCode;
      homeTeam = TEAM_MAP[homeCode] || homeCode;
    }

    console.log(`  ⚾ ${gameId}: ${awayTeam} ${awayScore} vs ${homeTeam} ${homeScore}`);
    console.log(`     원정 타자 ${awayBatters.length}명, 홈 타자 ${homeBatters.length}명`);

    return {
      gameId,
      date,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status: 'finished',
      startTime: '18:30',
      batterRecords: {
        away: awayBatters,
        home: homeBatters,
      },
      events,
    };
  } catch (err) {
    console.error(`  ❌ ${gameId} 파싱 실패:`, (err as Error).message);
    return null;
  }
}

// ─── 3단계: 서버로 전송 ───
async function sendToServer(games: GameResult[]): Promise<void> {
  if (!INTERNAL_KEY) {
    console.error('❌ INTERNAL_API_KEY가 설정되지 않았습니다.');
    console.log('   export INTERNAL_API_KEY=your-key');
    return;
  }

  try {
    const res = await axios.post(
      `${API_URL}/internal/games`,
      games,
      {
        headers: {
          'x-internal-key': INTERNAL_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    console.log('\n✅ 서버 전송 완료:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ 서버 전송 실패:', (err as any).response?.data || (err as Error).message);
  }
}

// ─── 4단계: 정산 트리거 ───
async function settleGames(gameIds: string[]): Promise<void> {
  for (const gameId of gameIds) {
    try {
      const res = await axios.post(
        `${API_URL}/internal/games/${gameId}/settle`,
        {},
        {
          headers: { 'x-internal-key': INTERNAL_KEY },
          timeout: 30000,
        }
      );
      console.log(`  ✅ ${gameId} 정산 완료: ${res.data.settledCount}건`);
    } catch (err) {
      console.error(`  ❌ ${gameId} 정산 실패:`, (err as any).response?.data || (err as Error).message);
    }
  }
}

// ─── 메인 실행 ───
async function main() {
  const args = process.argv.slice(2);
  let date = todayKST();
  let doSettle = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) date = args[i + 1];
    if (args[i] === '--settle') doSettle = true;
  }

  console.log(`\n🐾 비스트리그 자동 수집기`);
  console.log(`📅 날짜: ${date}`);
  console.log(`🌐 서버: ${API_URL}\n`);

  // 1) 경기 목록
  const gameIds = await fetchGameList(date);
  if (gameIds.length === 0) {
    console.log('⚠️  경기가 없거나 목록을 가져올 수 없습니다.');
    return;
  }

  // 2) 각 경기 상세 파싱
  const games: GameResult[] = [];
  for (const id of gameIds) {
    const result = await fetchGameDetail(id, date);
    if (result) {
      games.push(result);
      // 요청 간격 (예의상)
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (games.length === 0) {
    console.log('⚠️  파싱된 경기가 없습니다.');
    return;
  }

  // 3) 결과 요약
  console.log(`\n📊 수집 결과 요약:`);
  for (const g of games) {
    const awayHR = g.batterRecords.away.reduce((s, b) => s + b.homeRuns, 0);
    const homeHR = g.batterRecords.home.reduce((s, b) => s + b.homeRuns, 0);
    const awaySB = g.batterRecords.away.reduce((s, b) => s + b.stolenBases, 0);
    const homeSB = g.batterRecords.home.reduce((s, b) => s + b.stolenBases, 0);
    console.log(`  ${g.awayTeam} ${g.awayScore} vs ${g.homeTeam} ${g.homeScore} | HR:${awayHR+homeHR} SB:${awaySB+homeSB} 이벤트:${g.events.length}개`);
  }

  // 4) 서버 전송
  console.log('\n📤 서버로 전송 중...');
  await sendToServer(games);

  // 5) 정산 (옵션)
  if (doSettle) {
    console.log('\n⚡ 정산 실행 중...');
    await settleGames(games.map(g => g.gameId));
  }

  console.log('\n🎉 완료!');
}

main().catch(console.error);
