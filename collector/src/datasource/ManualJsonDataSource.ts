import * as fs from 'fs';
import * as path from 'path';
import { GameData, IDataSource } from '@beastleague/shared';
import { sanitizeGameData } from '../validator/GameDataValidator';

export class ManualJsonDataSource implements IDataSource {
  constructor(private readonly dataDir: string) {}

  // ── 내부 유틸 ───────────────────────────────────────────

  private datePath(date: string): string {
    return path.join(this.dataDir, date);
  }

  private gamePath(date: string, gameId: string): string {
    return path.join(this.datePath(date), `${gameId}.json`);
  }

  /** 파일 하나를 읽어 GameData로 파싱. 실패 시 null. */
  private readGameFile(filePath: string): GameData | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      const game = sanitizeGameData(parsed);
      if (!game) {
        console.warn(`[ManualJsonDataSource] 검증 실패, 스킵: ${filePath}`);
      }
      return game;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      console.error(`[ManualJsonDataSource] JSON 파싱 오류, 스킵: ${filePath}`, err);
      return null;
    }
  }

  /** 날짜 디렉토리의 모든 .json 파일 경로 반환 */
  private listJsonFiles(date: string): string[] {
    const dir = this.datePath(date);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(dir, f));
  }

  // ── IDataSource 구현 ────────────────────────────────────

  async getTodayGames(date: string): Promise<GameData[]> {
    return this.listJsonFiles(date)
      .map((f) => this.readGameFile(f))
      .filter((g): g is GameData => g !== null);
  }

  async getGamesByDate(date: string): Promise<GameData[]> {
    return this.getTodayGames(date);
  }

  async getGameById(gameId: string): Promise<GameData | null> {
    // gameId 앞 8자리 → 날짜: "20260401HTSS0" → "2026-04-01"
    if (gameId.length < 8) return null;
    const raw = gameId.slice(0, 8); // "20260401"
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return this.readGameFile(this.gamePath(date, gameId));
  }

  async getLiveGames(): Promise<GameData[]> {
    if (!fs.existsSync(this.dataDir)) return [];
    const dateDirs = fs
      .readdirSync(this.dataDir)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

    const live: GameData[] = [];
    for (const date of dateDirs) {
      const games = await this.getTodayGames(date);
      live.push(...games.filter((g) => g.status === 'live'));
    }
    return live;
  }

  async upsertGame(game: GameData): Promise<void> {
    const dir = this.datePath(game.date);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = this.gamePath(game.date, game.gameId);
    fs.writeFileSync(filePath, JSON.stringify(game, null, 2), 'utf-8');
  }
}
