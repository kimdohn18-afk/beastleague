import { GameData } from '../types/GameData';

export interface IDataSource {
  /** 특정 날짜의 모든 경기 목록 */
  getTodayGames(date: string): Promise<GameData[]>;

  /** gameId로 단일 경기 조회 */
  getGameById(gameId: string): Promise<GameData | null>;

  /** 날짜별 경기 목록 (getTodayGames 동일, 명시적 alias) */
  getGamesByDate(date: string): Promise<GameData[]>;

  /** status가 'live'인 경기 목록 */
  getLiveGames(): Promise<GameData[]>;

  /** 경기 데이터 삽입 또는 업데이트 */
  upsertGame(game: GameData): Promise<void>;
}
