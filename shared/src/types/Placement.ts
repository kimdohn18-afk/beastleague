import { TeamCode, BatterGroupType } from './GameData';

export type PlacementStatus = 'pending' | 'active' | 'settled';

export interface Placement {
  id: string;
  userId: string;
  characterId: string;
  gameId: string;
  team: TeamCode;
  groupType: BatterGroupType;
  date: string; // YYYY-MM-DD
  status: PlacementStatus;
  createdAt: string; // ISO 8601
}
