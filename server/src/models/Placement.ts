import { Schema, model, Document, Types } from 'mongoose';

export interface IPlacement extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  gameId: string;
  team: string;
  battingOrder: number;
  predictedWinner: string;
  date: string;
  status: 'pending' | 'active' | 'settled';
  isCorrect?: boolean;
  xpFromPlayer: number;
  xpFromPrediction: number;
  createdAt: Date;
}

const placementSchema = new Schema<IPlacement>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId:     { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    gameId:          { type: String, required: true },
    team:            { type: String, required: true },
    battingOrder:    { type: Number, required: true, min: 1, max: 9 },
    predictedWinner: { type: String, required: true },
    date:            { type: String, required: true },
    status:          { type: String, enum: ['pending', 'active', 'settled'], default: 'active' },
    isCorrect:       { type: Boolean },
    xpFromPlayer:    { type: Number, default: 0 },
    xpFromPrediction:{ type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

placementSchema.index({ userId: 1, date: 1 }, { unique: true });
placementSchema.index({ gameId: 1, status: 1 });

export const Placement = model<IPlacement>('Placement', placementSchema);
