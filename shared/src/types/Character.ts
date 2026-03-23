export type StatType = 'power' | 'agility' | 'skill' | 'stamina' | 'mind';

export interface CharacterStats {
  power: number;   // 1–100
  agility: number;
  skill: number;
  stamina: number;
  mind: number;
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  animalType: string;
  level: number;      // 1–99
  xp: number;
  loyalty: number;    // 성실도 0–100
  stats: CharacterStats;
  createdAt: string;  // ISO 8601
  updatedAt: string;
}
