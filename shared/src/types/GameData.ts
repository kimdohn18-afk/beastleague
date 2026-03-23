export type GameStatus = 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';

export type BatterGroupType = 'leadoff' | 'cleanup' | 'lower' | 'starter_pitcher';

export type TeamCode =
  | '광주'
  | '대구'
  | '서울L'
  | '서울D'
  | '수원'
  | '인천'
  | '대전'
  | '부산'
  | '창원'
  | '서울K';

export interface BatterGroupStats {
  AB: number;
  H: number;
  '2B': number;
  '3B': number;
  HR: number;
  RBI: number;
  RUN: number;
  SB: number;
  BB: number;
  K: number;
}

export interface PitcherStats {
  IP: number;
  PITCH: number;
  H: number;
  K: number;
  BB: number;
  ER: number;
}

export interface BatterGroup {
  team: TeamCode;
  groupType: BatterGroupType;
  stats: BatterGroupStats;
}

export interface PitcherEntry {
  team: TeamCode;
  role: 'starter';
  stats: PitcherStats;
}

export interface GameData {
  gameId: string;
  date: string; // YYYY-MM-DD
  homeTeam: TeamCode;
  awayTeam: TeamCode;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  batterGroups: BatterGroup[];
  pitchers?: PitcherEntry[];
  updatedAt: string; // ISO 8601
}
