#!/usr/bin/env ts-node
/**
 * CSV 빠른 입력 도구
 * 실행: npx ts-node collector/src/tools/quickInput.ts --date 2026-04-01 --file data/input.csv
 *
 * CSV 형식 (헤더 포함):
 * homeTeam,awayTeam,homeScore,awayScore,group,team,AB,H,2B,3B,HR,RBI,RUN,SB,BB,K
 *
 * starter_pitcher 행은 컬럼 재활용:
 * group=starter_pitcher 일 때 AB→IP, H→PITCH, 2B→H허용, 3B→K, HR→BB, RBI→ER
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { GameData, TeamCode, BatterGroupType } from '@beastleague/shared';
import { validateGameData } from '../validator/GameDataValidator';
import { ManualJsonDataSource } from '../datasource/ManualJsonDataSource';

const TEAM_TO_KBO: Record<TeamCode, string> = {
  '광주': 'HT', '대구': 'SS', '서울L': 'LG', '서울D': 'OB',
  '수원': 'KT', '인천': 'SK', '대전': 'HH', '부산': 'LT', '창원': 'NC', '서울K': 'WO',
};

function generateGameId(date: string, homeTeam: TeamCode, awayTeam: TeamCode): string {
  const d = date.replace(/-/g, '');
  return `${d}${TEAM_TO_KBO[awayTeam]}${TEAM_TO_KBO[homeTeam]}0`;
}

interface CsvRow {
  homeTeam: TeamCode;
  awayTeam: TeamCode;
  homeScore: number;
  awayScore: number;
  group: string;
  team: TeamCode;
  AB: number; H: number; '2B': number; '3B': number; HR: number;
  RBI: number; RUN: number; SB: number; BB: number; K: number;
}

function parseRow(header: string[], values: string[]): CsvRow | null {
  if (values.length < header.length) return null;
  const obj: Record<string, string> = {};
  header.forEach((k, i) => { obj[k] = values[i].trim(); });

  const numFields = ['homeScore', 'awayScore', 'AB', 'H', '2B', '3B', 'HR', 'RBI', 'RUN', 'SB', 'BB', 'K'];
  const parsed: Record<string, unknown> = { ...obj };
  for (const f of numFields) parsed[f] = parseFloat(obj[f] ?? '0') || 0;

  return parsed as unknown as CsvRow;
}

async function parseCsv(filePath: string): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
  let header: string[] = [];

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(',');
    if (header.length === 0) { header = parts.map((h) => h.trim()); continue; }
    const row = parseRow(header, parts);
    if (row) rows.push(row);
  }
  return rows;
}

function rowsToGames(date: string, rows: CsvRow[]): GameData[] {
  // homeTeam+awayTeam 조합으로 그룹핑
  const gameMap = new Map<string, GameData>();

  for (const row of rows) {
    const key = `${row.homeTeam}__${row.awayTeam}`;
    if (!gameMap.has(key)) {
      gameMap.set(key, {
        gameId: generateGameId(date, row.homeTeam, row.awayTeam),
        date,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        status: 'finished',
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        batterGroups: [],
        pitchers: [],
        updatedAt: new Date().toISOString(),
      });
    }
    const game = gameMap.get(key)!;

    if (row.group === 'starter_pitcher') {
      // 컬럼 재활용: AB→IP, H→PITCH, 2B→H허용, 3B→K, HR→BB, RBI→ER
      game.pitchers!.push({
        team: row.team,
        role: 'starter',
        stats: {
          IP: row.AB,
          PITCH: row.H,
          H: row['2B'],
          K: row['3B'],
          BB: row.HR,
          ER: row.RBI,
        },
      });
    } else {
      game.batterGroups.push({
        team: row.team,
        groupType: row.group as BatterGroupType,
        stats: {
          AB: row.AB, H: row.H, '2B': row['2B'], '3B': row['3B'],
          HR: row.HR, RBI: row.RBI, RUN: row.RUN, SB: row.SB,
          BB: row.BB, K: row.K,
        },
      });
    }
  }

  // pitchers 빈 배열이면 undefined
  for (const game of gameMap.values()) {
    if (game.pitchers!.length === 0) game.pitchers = undefined;
  }

  return Array.from(gameMap.values());
}

async function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf('--date');
  const fileIdx = args.indexOf('--file');

  if (dateIdx === -1 || fileIdx === -1) {
    console.error('사용법: npx ts-node quickInput.ts --date YYYY-MM-DD --file path/to/input.csv');
    process.exit(1);
  }

  const date = args[dateIdx + 1];
  const csvPath = path.resolve(args[fileIdx + 1]);

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 파일 없음: ${csvPath}`);
    process.exit(1);
  }

  const rows = await parseCsv(csvPath);
  const games = rowsToGames(date, rows);
  const ds = new ManualJsonDataSource(path.resolve(process.cwd(), 'data'));

  let saved = 0, failed = 0;
  for (const game of games) {
    const { valid, errors } = validateGameData(game);
    if (!valid) {
      console.error(`[✗] ${game.gameId} — 검증 실패:`);
      errors.forEach((e) => console.error(`    ${e}`));
      failed++;
      continue;
    }
    await ds.upsertGame(game);
    console.log(`[✓] ${game.gameId} 저장 완료`);
    saved++;
  }

  console.log(`\n요약: ${games.length}경기 중 ${saved}개 저장, ${failed}개 실패`);
}

main().catch((e) => { console.error(e); process.exit(1); });
