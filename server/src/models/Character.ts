import { Schema, model, Document, Types } from 'mongoose';

export interface ICharacter extends Document {
  userId: Types.ObjectId;
  name: string;
  animalType: string;

  // XP 구조
  totalXp: number;     // 누적 XP (절대 감소 안 함, 랭킹/진화 기준)
  currentXp: number;   // 보유 XP (소비 가능 — 캐릭터 변경 등)

  // 기존 필드
  xp: number;  // 하위호환용 — totalXp와 동기화, 점진적으로 제거 예정
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
  lastShareDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const characterSchema = new Schema<ICharacter>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    animalType: { type: String, required: true },

    totalXp: { type: Number, default: 0 },
    currentXp: { type: Number, default: 0 },
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
    lastShareDate: { type: String, default: null },
  },
  { timestamps: true },
);

characterSchema.index({ userId: 1 }, { unique: true });
characterSchema.index({ totalXp: -1 });

export const Character = model<ICharacter>('Character', characterSchema);
