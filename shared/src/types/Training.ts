import { CharacterStats } from './Character';

export type TrainingType = 'batting' | 'fielding' | 'running' | 'mental' | 'conditioning';

export interface Training {
  id: string;
  userId: string;
  characterId: string;
  type: TrainingType;
  date: string;        // YYYY-MM-DD
  session: 1 | 2 | 3; // 하루 최대 3회
  statChanges: Partial<CharacterStats>;
  xpGained: number;
  createdAt: string;   // ISO 8601
}
