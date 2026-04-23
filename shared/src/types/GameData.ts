// shared/src/types/GameData.ts

export type GameStatus = 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';

export type TeamCode =
  | 'KT' | 'LG' | 'SSG' | 'NC' | 'KIA'
  | '두산' | '롯데' | '삼성' | '한화' | '키움';

export interface BatterRecord {
  order: string;
  position: string;
  name: string;
  atBats: string;
  hits: string;
  rbi: string;
  runs: string;
  avg: string;
  homeRuns?: number;
  doubles?: number;
  triples?: number;
  stolenBases?: number;
  stolenBaseFails?: number;
  walks?: number;
  walkOff?: boolean;
}

export interface GameEvent {
  type: string;
  detail: string;
}

export interface GameData {
  gameId: string;
  date: string;
  homeTeam: TeamCode;
  awayTeam: TeamCode;
  status: GameStatus;
  startTime?: string;
  homeScore?: number;
  awayScore?: number;
  batterRecords?: {
    away: BatterRecord[];
    home: BatterRecord[];
  };
  events?: GameEvent[];
}
