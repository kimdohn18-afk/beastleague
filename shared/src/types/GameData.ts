export type GameStatus = 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';

export type TeamCode =
  | 'KT' | 'LG' | 'SSG' | 'NC' | 'KIA'
  | '두산' | '롯데' | '삼성' | '한화' | '키움';

export interface GameData {
  gameId: string;
  date: string;
  homeTeam: TeamCode;
  awayTeam: TeamCode;
  status: GameStatus;
  startTime?: string;  
  homeScore?: number;
  awayScore?: number;
 }
