import { Schema, model, Document, Types } from 'mongoose';

export interface ICharacter extends Document {
  userId: Types.ObjectId;
  name: string;
  animalType: string;
  xp: number;
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
  createdAt: Date;
  totalFeeds: number;
  updatedAt: Date;
}

const characterSchema = new Schema<ICharacter>(
  {
    userId:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:               { type: String, required: true },
    animalType:         { type: String, required: true },
    xp:                 { type: Number, default: 0 },
    streak:             { type: Number, default: 0 },
    lastPlacementDate:  { type: String, default: null },
    totalPlacements:    { type: Number, default: 0 },
    activeTrait:        { type: String, default: null },
    earnedBadges:       [{ type: String }],
    earnedAchievements: [{ type: String }],
    teamAchievements: [{
      teamId: { type: String },
      tier: { type: String },
      count: { type: Number },
    }],
    tutorialCompleted: { type: Boolean, default: false },
    totalLikes: { type: Number, default: 0 },
     totalFeeds: { type: Number, default: 0 },
    totalFeeds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

characterSchema.index({ userId: 1 }, { unique: true });

export const Character = model<ICharacter>('Character', characterSchema);
