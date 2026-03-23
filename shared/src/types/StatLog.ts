import { CharacterStats } from './Character';

export type StatChangeSource = 'game' | 'training' | 'battle' | 'levelup';

export interface StatLog {
  id: string;
  userId: string;
  characterId: string;
  source: StatChangeSource;
  sourceId: string;
  before: CharacterStats;
  after: CharacterStats;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  createdAt: string; // ISO 8601
}
