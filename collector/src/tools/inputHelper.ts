#!/usr/bin/env ts-node
/**
 * 대화형 CLI — 경기 결과 수동 입력 도구
 * 실행: npx ts-node collector/src/tools/inputHelper.ts
 */
import * as readline from 'readline';
import * as path from 'path';
import { GameData, TeamCode, BatterGroupStats, PitcherStats, BatterGroupType } from '@beastleague/shared';
import { validateGameData } from '../validator/GameDataValidator';
import { ManualJsonDataSource } from '../datasource/ManualJsonDataSource';

// ── 상수 ──────────────────────────────────────────────────
const TEAM_CODES: TeamCode[] = [
  '광주', '대구', '서울L', '서울D', '수원', '인천', '대전', '부산', '창원', '서울K',
];

const TEAM_TO_KBO: Record<TeamCode, string> = {
  '광주': 'HT', '대구': 'SS', '서울L': 'LG', '서울D': 'OB',
  '수원': 'KT', '인천': 'SK', '대전': 'HH', '부산': 'LT', '창원': 'NC', '서울K': 'WO',
};

const BATTER_GROUP_TYPES: BatterGroupType[] = ['leadoff', 'cleanup', 'lower'];
const GROUP_LABELS: Record<string, string> = {
  leadoff: '상위타선 (1~2번)',
  cleanup: '클린업 (3~5번)',
  lower: '하위타선 (6~9번)',
};

const DATA_DIR = path.resolve(process.cwd(), 'data');

// ── readline 래퍼 ─────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateGameId(date: string, homeTeam: TeamCode, awayTeam: TeamCode): string {
  const d = date.replace(/-/g, '');
  return `${d}${TEAM_TO_KBO[awayTeam]}${TEAM_TO_KBO[homeTeam]}0`;
}

async function askTeam(prompt: string): Promise<TeamCode> {
  console.log('\n팀 목록:', TEAM_CODES.map((t, i) => `${i + 1}.${t}`).join('  '));
  while (true) {
    const input = await ask(`${prompt} (번호 또는 이름): `);
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= TEAM_CODES.length) return TEAM_CODES[num - 1];
    if (TEAM_CODES.includes(input as TeamCode)) return input as TeamCode;
    console.log('올바른 팀을 선택해주세요.');
  }
}

async function askInt(prompt: string, defaultVal?: number): Promise<number> {
  while (true) {
    const raw = await ask(defaultVal !== undefined ? `${prompt} [기본값: ${defaultVal}]: ` : `${prompt}: `);
    if (raw.trim() === '' && defaultVal !== undefined) return defaultVal;
    const n = Number(raw);
    if (!isNaN(n) && n >= 0) return n;
    console.log('0 이상 숫자를 입력해주세요.');
  }
}

async function askFloat(prompt: string): Promise<number> {
  while (true) {
    const raw = await ask(`${prompt}: `);
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 0) return n;
    console.log('0 이상 숫자를 입력해주세요.');
  }
}

async function inputBatterGroup(team: TeamCode, groupType: BatterGroupType): Promise<BatterGroupStats> {
  console.log(`\n  [${team}] ${GROUP_LABELS[groupType]} 합산 스탯`);
  return {
    AB: await askInt('    AB'),
    H: await askInt('    H'),
    '2B': await askInt('    2B'),
    '3B': await askInt('    3B'),
    HR: await askInt('    HR'),
    RBI: await askInt('    RBI'),
    RUN: await askInt('    RUN'),
    SB: await askInt('    SB'),
    BB: await askInt('    BB'),
    K: await askInt('    K'),
  };
}

async function inputPitcher(team: TeamCode): Promise<PitcherStats | null> {
  const yn = await ask(`\n  [${team}] 선발투수 스탯 입력할까요? (y/N): `);
  if (yn.toLowerCase() !== 'y') return null;
  return {
    IP: await askFloat('    IP (이닝, e.g. 6.2)'),
    PITCH: await askInt('    투구 수'),
    H: await askInt('    피안타'),
    K: await askInt('    탈삼진'),
    BB: await askInt('    볼넷'),
    ER: await askInt('    자책점'),
  };
}

async function inputGame(date: string): Promise<GameData | null> {
  const homeTeam = await askTeam('홈팀');
  const awayTeam = await askTeam('원정팀');
  const statusRaw = await ask('경기 상태 (finished/cancelled/postponed) [기본값: finished]: ');
  const status = (['finished', 'cancelled', 'postponed'].includes(statusRaw.trim())
    ? statusRaw.trim()
    : 'finished') as GameData['status'];

  const homeScore = await askInt('홈팀 점수');
  const awayScore = await askInt('원정팀 점수');

  const batterGroups: GameData['batterGroups'] = [];
  for (const team of [homeTeam, awayTeam]) {
    for (const groupType of BATTER_GROUP_TYPES) {
      const stats = await inputBatterGroup(team, groupType);
      batterGroups.push({ team, groupType, stats });
    }
  }

  const pitchers: GameData['pitchers'] = [];
  for (const team of [homeTeam, awayTeam]) {
    const p = await inputPitcher(team);
    if (p) pitchers.push({ team, role: 'starter', stats: p });
  }

  const gameId = generateGameId(date, homeTeam, awayTeam);
  const game: GameData = {
    gameId, date, homeTeam, awayTeam, status,
    homeScore, awayScore,
    batterGroups,
    pitchers: pitchers.length > 0 ? pitchers : undefined,
    updatedAt: new Date().toISOString(),
  };

  const { valid, errors } = validateGameData(game);
  if (!valid) {
    console.error('\n검증 실패:');
    errors.forEach((e) => console.error('  -', e));
    const retry = await ask('다시 입력할까요? (y/N): ');
    if (retry.toLowerCase() === 'y') return inputGame(date);
    return null;
  }

  return game;
}

async function main() {
  console.log('=== 비스트리그 경기 결과 입력 도구 ===');
  console.log('⚠️  선수 이름/이니셜/등번호는 절대 입력하지 마세요.\n');

  const dateInput = await ask(`날짜 [기본값: ${today()}]: `);
  const date = dateInput.trim() || today();

  const countInput = await ask('경기 수 [기본값: 5]: ');
  const count = parseInt(countInput, 10) || 5;

  const ds = new ManualJsonDataSource(DATA_DIR);
  let saved = 0;

  for (let i = 0; i < count; i++) {
    console.log(`\n--- 경기 ${i + 1}/${count} ---`);
    const game = await inputGame(date);
    if (!game) {
      console.log('건너뜀.');
      continue;
    }
    await ds.upsertGame(game);
    console.log(`✓ 저장 완료: ${game.gameId}`);
    saved++;
  }

  console.log(`\n완료: ${count}경기 중 ${saved}경기 저장됨.`);
  rl.close();
}

main().catch((e) => { console.error(e); rl.close(); process.exit(1); });
