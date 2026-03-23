export type BattleResult = 'win' | 'lose' | 'draw';

export interface BattlePlayer {
  userId: string;
  characterId: string;
  statGain: number;
}

export interface Battle {
  id: string;
  date: string;   // YYYY-MM-DD
  gameId: string;
  player1: BattlePlayer;
  player2: BattlePlayer;
  result: {
    player1: BattleResult;
    player2: BattleResult;
  };
  xpAwarded: {
    player1: number;
    player2: number;
  };
  createdAt: string; // ISO 8601
}
