import { Schema, model, Document, Types } from 'mongoose';

export interface IStats {
  power: number;      // 파워 (타격력)
  agility: number;    // 민첩 (주루/수비)
  skill: number;      // 기술 (컨택/제구)
  stamina: number;    // 체력 (지구력)
  mind: number;       // 정신 (집중력)
}

export interface ICharacter extends Document {
  userId: Types.ObjectId;
  name: string;
  animalType: string;

  // XP 이중 구조
  totalXp: number;     // 누적 XP (랭킹용, 절대 감소 안 함)
  currentXp: number;   // 보유 XP (소비 가능)

  // 능력치
  stats: IStats;

  // 기존 필드
  xp: number;  // 하위호환용, totalXp와 동기화
  streak: number;
  lastPlacementDate: string | null;
  totalPlacements: number;
  activeTrait: string | null;
  earnedBadges: string[];
  earnedAchievements: string[];
  teamAchievements: Array<{ teamId: string; tier: string; count: number }>;
  tutorialCompleted: boolean;
  totalLikes: number;
  totalFeeds: number;
  displayStage: number | null;
  displaySize: number | null;
  evolvedStage: number;
  createdAt: Date;
  updatedAt: Date;
}

const statsSchema = new Schema<IStats>(
  {
    power: { type: Number, default: 1 },
    agility: { type: Number, default: 1 },
    skill: { type: Number, default: 1 },
    stamina: { type: Number, default: 1 },
    mind: { type: Number, default: 1 },
  },
  { _id: false }
);

const characterSchema = new Schema<ICharacter>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    animalType: { type: String, required: true },

    totalXp: { type: Number, default: 0 },
    currentXp: { type: Number, default: 0 },

    stats: { type: statsSchema, default: () => ({ power: 1, agility: 1, skill: 1, stamina: 1, mind: 1 }) },

    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastPlacementDate: { type: String, default: null },
    totalPlacements: { type: Number, default: 0 },
    activeTrait: { type: String, default: null },
    earnedBadges: [{ type: String }],
    earnedAchievements: [{ type: String }],
    teamAchievements: [{ teamId: String, tier: String, count: Number }],
    tutorialCompleted: { type: Boolean, default: false },
    totalLikes: { type: Number, default: 0 },
    totalFeeds: { type: Number, default: 0 },
    displayStage: { type: Number, default: null },
    displaySize: { type: Number, default: null },
    evolvedStage: { type: Number, default: 1 },
  },
  { timestamps: true },
);

characterSchema.index({ userId: 1 }, { unique: true });
characterSchema.index({ totalXp: -1 }); // 랭킹 정렬용

export const Character = model<ICharacter>('Character', characterSchema);
