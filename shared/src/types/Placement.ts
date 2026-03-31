import { TeamCode } from './GameData';

export type PlacementStatus = 'pending' | 'active' | 'settled';

export interface Placement {
  id: string;
  userId: string;
  characterId: string;
  gameId: string;
  team: TeamCode;
  battingOrder: number;       // 1~9 타순
  predictedWinner: TeamCode;  // 승리 예측팀
  date: string;               // YYYY-MM-DD
  status: PlacementStatus;
  isCorrect?: boolean;
  xpFromPlayer: number;
  xpFromPrediction: number;
  createdAt: string;          // ISO 8601
}
