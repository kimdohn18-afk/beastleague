export type GameStatus = 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';

export type TeamCode =
  | 'KT' | 'LG' | 'SSG' | 'NC' | 'KIA'
  | '두산' | '롯데' | '삼성' | '한화' | '키움';

export interface BatterRecord {
  order: string;       // 타순 ("1"~"9", 교체선수는 "")
  position: string;    // 포지션 ("중", "一", "좌" 등)
  name: string;        // 선수명
  atBats: string;      // 타수
  hits: string;        // 안타
  rbi: string;         // 타점
  runs: string;        // 득점
  avg: string;         // 타율
}

export interface GameEvent {
  type: string;        // "홈런", "2루타", "도루", "결승타" 등
  detail: string;      // 상세 내용
}

export interface GameData {
  gameId: string;
  date: string;                        // YYYY-MM-DD
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
