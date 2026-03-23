import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManualJsonDataSource } from '../datasource/ManualJsonDataSource';
import { GameData } from '@beastleague/shared';

const SAMPLE_GAME: GameData = {
  gameId: '20260401HTSS0',
  date: '2026-04-01',
  homeTeam: '광주',
  awayTeam: '대구',
  status: 'finished',
  homeScore: 5,
  awayScore: 3,
  batterGroups: [
    {
      team: '광주',
      groupType: 'leadoff',
      stats: { AB: 8, H: 3, '2B': 1, '3B': 0, HR: 1, RBI: 3, RUN: 2, SB: 1, BB: 2, K: 1 },
    },
    {
      team: '대구',
      groupType: 'leadoff',
      stats: { AB: 8, H: 2, '2B': 0, '3B': 0, HR: 0, RBI: 1, RUN: 1, SB: 0, BB: 1, K: 2 },
    },
  ],
  updatedAt: '2026-04-01T14:00:00.000Z',
};

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'beastleague-test-'));
}

describe('ManualJsonDataSource', () => {
  let tmpDir: string;
  let ds: ManualJsonDataSource;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    ds = new ManualJsonDataSource(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('upsertGame → 파일 생성, getGameById로 재읽기 일치', async () => {
    await ds.upsertGame(SAMPLE_GAME);
    const retrieved = await ds.getGameById(SAMPLE_GAME.gameId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.gameId).toBe(SAMPLE_GAME.gameId);
    expect(retrieved!.homeTeam).toBe('광주');
    expect(retrieved!.awayTeam).toBe('대구');
  });

  it('getTodayGames → 저장한 경기 반환', async () => {
    await ds.upsertGame(SAMPLE_GAME);
    const games = await ds.getTodayGames('2026-04-01');
    expect(games).toHaveLength(1);
    expect(games[0].gameId).toBe(SAMPLE_GAME.gameId);
  });

  it('존재하지 않는 날짜 → 빈 배열 반환', async () => {
    const games = await ds.getTodayGames('2099-01-01');
    expect(games).toEqual([]);
  });

  it('잘못된 JSON 파일 → 스킵하고 에러 미발생', async () => {
    const dir = path.join(tmpDir, '2026-04-01');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'bad.json'), '{invalid json}}', 'utf-8');
    await expect(ds.getTodayGames('2026-04-01')).resolves.toEqual([]);
  });

  it('getGameById — 존재하지 않는 gameId → null 반환', async () => {
    const result = await ds.getGameById('20260401XXXXXX0');
    expect(result).toBeNull();
  });

  it('getLiveGames — live 경기 반환', async () => {
    const liveGame: GameData = { ...SAMPLE_GAME, gameId: '20260401HTSS1', status: 'live' };
    await ds.upsertGame(liveGame);
    await ds.upsertGame(SAMPLE_GAME); // finished — 제외되어야 함
    const live = await ds.getLiveGames();
    expect(live).toHaveLength(1);
    expect(live[0].status).toBe('live');
  });
});
