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
  tutorialCompleted: boolean;
  createdAt: Date;
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
    tutorialCompleted:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

characterSchema.index({ userId: 1 }, { unique: true });

export const Character = model<ICharacter>('Character', characterSchema);
