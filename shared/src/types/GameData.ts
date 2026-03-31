export type GameStatus = 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';

export type TeamCode =
  | 'KT' | 'LG' | 'SSG' | 'NC' | 'KIA'
  | '두산' | '롯데' | '삼성' | '한화' | '키움';

// === 새 구조: 개별 타자 기록 ===
export interface BatterRecord {
  order: string;
  position: string;
  name: string;
  atBats: string;
  hits: string;
  rbi: string;
  runs: string;
  avg: string;
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
  homeScore?: number;
  awayScore?: number;
  batterRecords?: {
    away: BatterRecord[];
    home: BatterRecord[];
  };
  events?: GameEvent[];
}

// === 레거시 호환: StatEngine에서 사용 ===
export type BatterGroupType = 'leadoff' | 'cleanup' | 'lower' | 'starter_pitcher';

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
