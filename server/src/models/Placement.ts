import { Schema, model, Document, Types } from 'mongoose';

export interface IPlacement extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  gameId: string;
  team: string;
  groupType: string;
  date: string;
  status: 'pending' | 'active' | 'settled';
  createdAt: Date;
}

const placementSchema = new Schema<IPlacement>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    gameId:      { type: String, required: true },
    team:        { type: String, required: true },
    groupType:   { type: String, required: true },
    date:        { type: String, required: true },
    status:      { type: String, enum: ['pending', 'active', 'settled'], default: 'active' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

placementSchema.index({ userId: 1, date: 1 }, { unique: true });
placementSchema.index({ gameId: 1, status: 1 });

export const Placement = model<IPlacement>('Placement', placementSchema);
