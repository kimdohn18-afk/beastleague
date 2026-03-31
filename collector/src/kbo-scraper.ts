/**
 * KBO 경기 데이터 수집기
 * 
 * 1) fetchSchedule(date) - 경기 일정 + 스코어 수집
 * 2) fetchBoxScore(gameId) - 개별 경기 박스스코어(타순별 타자 성적) 수집
 * 
 * 데이터 소스: koreabaseball.com
 */

import https from 'https';
import http from 'http';

// ============ HTML 가져오기 (cheerio 없이 정규식 파싱) ============

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ============ 타입 정의 ============

export interface GameSchedule {
  gameId: string;
  date: string;        // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';
  time: string;        // HH:MM
  stadium: string;
}

export interface BatterRecord {
  order: number;       // 타순 1~9
  position: string;    // 포지션 (중, 좌, 우, 一, 二, 三, 유, 포, 지)
  name: string;        // 선수 이름
  atBats: number;      // 타수
  hits: number;        // 안타
  rbi: number;         // 타점
  runs: number;        // 득점
  battingAvg: number;  // 타율
  details: string[];   // 이닝별 상세 (우안, 좌2, 좌홈 등)
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

// ============ 팀 코드 매핑 ============

const TEAM_CODE_MAP: Record<string, string> = {
  'KT': 'KT', 'LG': 'LG', 'SSG': 'SSG', 'NC': 'NC',
  'KIA': 'KIA', '두산': '두산', '롯데': '롯데', '삼성': '삼성',
  '한화': '한화', '키움': '키움',
};

// ============ 1. 경기 일정 수집 ============

export async function fetchSchedule(date: string): Promise<GameSchedule[]> {
  // date: YYYY-MM-DD → YYYYMMDD
  const dateParam = date.replace(/-/g, '');
  const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0&gameDate=${dateParam}`;

  const html = await fetchHtml(url);
  const games: GameSchedule[] = [];

  // 경기 행 파싱: "팀A_스코어vs스코어_팀B" 또는 "팀A_vs_팀B" 패턴
  // gameId는 리뷰/프리뷰 링크에서 추출
  const gameIdRegex = /gameId=(\d{8}[A-Z]+\d)/g;
  const gameIds: string[] = [];
  let match;

  while ((match = gameIdRegex.exec(html)) !== null) {
    if (!gameIds.includes(match[1])) {
      gameIds.push(match[1]);
    }
  }

  // 경기 결과 패턴: "팀A_숫자vs숫자_팀B" 
  const resultRegex = /(\S+?)_(\d+)vs(\d+)_(\S+)/g;
  const results: Array<{ away: string; awayScore: number; homeScore: number; home: string }> = [];

  while ((match = resultRegex.exec(html)) !== null) {
    results.push({
      away: match[1],
      awayScore: parseInt(match[2]),
      homeScore: parseInt(match[3]),
      home: match[4],
    });
  }

  // 예정 경기 패턴: "팀A_vs_팀B"
  const scheduledRegex = /(\S+?)_vs_(\S+)/g;
  const scheduled: Array<{ away: string; home: string }> = [];

  while ((match = scheduledRegex.exec(html)) !== null) {
    // 이미 결과에 포함된 팀 조합은 제외
    const alreadyHasResult = results.some(
      (r) => r.away === match![1] && r.home === match![2]
    );
    if (!alreadyHasResult) {
      scheduled.push({ away: match[1], home: match[2] });
    }
  }

  // 시간 패턴
  const timeRegex = /(\d{2}:\d{2})/g;
  const times: string[] = [];
  while ((match = timeRegex.exec(html)) !== null) {
    times.push(match[1]);
  }

  // 구장 패턴
  const stadiumRegex = /(잠실|문학|대구|창원|대전|수원|사직|고척|광주)/g;
  const stadiums: string[] = [];
  while ((match = stadiumRegex.exec(html)) !== null) {
    if (!stadiums.includes(match[1]) || stadiums.length < gameIds.length) {
      stadiums.push(match[1]);
    }
  }

  // 결과 경기 조합
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    games.push({
      gameId: gameIds[i] || `${dateParam}GAME${i}`,
      date,
      awayTeam: r.away,
      homeTeam: r.home,
      awayScore: r.awayScore,
      homeScore: r.homeScore,
      status: 'finished',
      time: times[i] || '18:30',
      stadium: stadiums[i] || '',
    });
  }

  // 예정 경기 조합
  for (let i = 0; i < scheduled.length; i++) {
    const s = scheduled[i];
    const idx = results.length + i;
    games.push({
      gameId: gameIds[idx] || `${dateParam}GAME${idx}`,
      date,
      awayTeam: s.away,
      homeTeam: s.home,
      status: 'scheduled',
      time: times[idx] || '18:30',
      stadium: stadiums[idx] || '',
    });
  }

  return games;
}

// ============ 2. 박스스코어 수집 ============

export async function fetchBoxScore(gameId: string): Promise<BoxScoreResult | null> {
  const year = gameId.substring(0, 4);
  const url = `https://www.koreabaseball.com/futures/schedule/BoxScore.aspx?leagueId=1&seriesId=0&seasonId=${year}&gameId=${gameId}`;

  const html = await fetchHtml(url);

  if (html.includes('이용에 불편을 드려') || html.length < 1000) {
    console.error(`박스스코어를 가져올 수 없습니다: ${gameId}`);
    return null;
  }

  // 날짜 추출
  const dateMatch = html.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

  // 스코어 추출: R | H | E | B 테이블에서
  const scoreRegex = /\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/g;
  const scores: Array<{ r: number; h: number; e: number; b: number }> = [];
  while ((match = scoreRegex.exec(html)) !== null) {
    scores.push({
      r: parseInt(match[1]),
      h: parseInt(match[2]),
      e: parseInt(match[3]),
      b: parseInt(match[4]),
    });
  }

  // 팀 이름 추출 (AWAY/HOME 근처)
  const teamRegex = /(?:AWAY|HOME).*?(\d)승\s*(\d)패/g;

  // 타자 기록 파싱
  function parseBatterTable(tableHtml: string): BatterRecord[] {
    const batters: BatterRecord[] = [];
    // 행 패턴: | 순번 | 포지션 | 이름 | ... | 타수 | 안타 | 타점 | 득점 | 타율 |
    const rowRegex = /\|\s*(\d+)\s*\|\s*([가-힣一二三中左右遊捕指유포중좌우]+)\s*\|\s*([가-힣a-zA-Z]+)\s*/g;

    let rowMatch;
    let currentOrder = 0;

    // 더 단순한 접근: 이름과 숫자 기록을 따로 파싱
    const lines = tableHtml.split('\n');
    for (const line of lines) {
      // "| 1 | 중 | 최원준 |" 패턴
      const orderMatch = line.match(/\|\s*(\d)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|/);
      if (orderMatch) {
        const order = parseInt(orderMatch[1]);
        if (order >= 1 && order <= 9) {
          currentOrder = order;
        }
      }
    }

    return batters;
  }

  // 간단한 파싱: 타자 기록 섹션 찾기
  const awayBatters: BatterRecord[] = [];
  const homeBatters: BatterRecord[] = [];

  // "타자 기록" 섹션을 찾아서 파싱
  // HTML 구조: 선수명 | 타수 | 안타 | 타점 | 득점 | 타율
  const sections = html.split('타자 기록');

  if (sections.length >= 3) {
    // sections[1] = 원정팀 타자, sections[2] = 홈팀 타자
    const parseSection = (section: string): BatterRecord[] => {
      const records: BatterRecord[] = [];
      const lines = section.split('\n');

      let orderCounter = 0;
      let lastOrder = 0;

      for (const line of lines) {
        // 타순 + 포지션 + 이름 패턴
        const nameMatch = line.match(/\|\s*(\d)?\s*\|\s*([가-힣一二三]+)\s*\|\s*([가-힣a-zA-Z\s]+?)\s*\|/);
        if (nameMatch) {
          const order = nameMatch[1] ? parseInt(nameMatch[1]) : lastOrder;
          if (order >= 1 && order <= 9 && order !== lastOrder) {
            orderCounter++;
            lastOrder = order;
          }
        }

        // 타수/안타/타점/득점/타율 패턴
        const statMatch = line.match(/\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([\d.]+|-)\s*\|/);
        if (statMatch && nameMatch) {
          records.push({
            order: lastOrder,
            position: nameMatch[2],
            name: nameMatch[3].trim(),
            atBats: parseInt(statMatch[1]),
            hits: parseInt(statMatch[2]),
            rbi: parseInt(statMatch[3]),
            runs: parseInt(statMatch[4]),
            battingAvg: statMatch[5] === '-' ? 0 : parseFloat(statMatch[5]),
            details: [],
          });
        }
      }

      return records;
    };

    // 원정팀(먼저 나옴)과 홈팀 파싱
    awayBatters.push(...parseSection(sections[1]));
    homeBatters.push(...parseSection(sections[2]));
  }

  // 팀 이름 추출
  const teamNames = html.match(/(KT|LG|SSG|NC|KIA|두산|롯데|삼성|한화|키움)/g) || [];
  const uniqueTeams = [...new Set(teamNames)];

  return {
    gameId,
    date,
    awayTeam: uniqueTeams[0] || 'AWAY',
    homeTeam: uniqueTeams[1] || 'HOME',
    awayScore: scores[0]?.r || 0,
    homeScore: scores[1]?.r || 0,
    awayBatters,
    homeBatters,
  };
}

// ============ 3. XP 계산 ============

export function calculateXpFromBatter(batter: BatterRecord, details: string[]): number {
  let xp = 0;

  // 상세 기록에서 이벤트 추출
  for (const detail of details) {
    if (detail.includes('홈')) xp += 50;       // 홈런
    else if (detail.includes('3')) xp += 30;   // 3루타 (3루타 또는 삼진 구분 필요)
    else if (detail.includes('2') && detail.includes('안')) xp += 20; // 2루타
    else if (detail.includes('안')) xp += 10;  // 단타
    else if (detail.includes('4구') || detail.includes('사구')) xp += 10; // 볼넷
    else if (detail.includes('삼진')) xp -= 10; // 삼진
  }

  // 득점 보너스
  xp += batter.runs * 10;

  // 도루는 경기 내용에서 별도 파싱 필요 (향후 추가)

  return xp;
}

// ============ 4. 메인 실행 ============

async function main() {
  const command = process.argv[2];
  const param = process.argv[3];

  if (command === 'schedule') {
    // 사용법: npx ts-node kbo-scraper.ts schedule 2026-03-29
    const date = param || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    console.log(`경기 일정 수집: ${date}`);

    const games = await fetchSchedule(date);
    console.log(JSON.stringify(games, null, 2));
    console.log(`총 ${games.length}경기 수집`);

  } else if (command === 'boxscore') {
    // 사용법: npx ts-node kbo-scraper.ts boxscore 20260329KTLG0
    if (!param) {
      console.error('gameId를 입력하세요');
      process.exit(1);
    }
    console.log(`박스스코어 수집: ${param}`);

    const result = await fetchBoxScore(param);
    console.log(JSON.stringify(result, null, 2));

  } else if (command === 'daily') {
    // 사용법: npx ts-node kbo-scraper.ts daily 2026-03-29
    // 하루 전체: 일정 수집 → 종료된 경기 박스스코어 수집
    const date = param || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    console.log(`=== ${date} 전체 수집 시작 ===`);

    const games = await fetchSchedule(date);
    console.log(`${games.length}경기 발견`);

    for (const game of games) {
      console.log(`${game.awayTeam} vs ${game.homeTeam}: ${game.status}`);

      if (game.status === 'finished') {
        console.log(`  스코어: ${game.awayScore} - ${game.homeScore}`);
        console.log(`  박스스코어 수집 중...`);

        const box = await fetchBoxScore(game.gameId);
        if (box) {
          console.log(`  원정 타자: ${box.awayBatters.length}명`);
          console.log(`  홈 타자: ${box.homeBatters.length}명`);
        }

        // API에 전송 (TODO: 서버 내부 API 호출)
        // await sendToServer(game, box);
      }
    }

    console.log(`=== 수집 완료 ===`);

  } else {
    console.log('사용법:');
    console.log('  npx ts-node kbo-scraper.ts schedule [YYYY-MM-DD]');
    console.log('  npx ts-node kbo-scraper.ts boxscore [gameId]');
    console.log('  npx ts-node kbo-scraper.ts daily [YYYY-MM-DD]');
  }
}

main().catch(console.error);
