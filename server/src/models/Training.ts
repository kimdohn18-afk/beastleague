import { Schema, model, Document, Types } from 'mongoose';

export interface ITraining extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  type: string;
  date: string;
  session: 1 | 2 | 3;
  statChanges: Record<string, number>;
  xpGained: number;
  bonusApplied: boolean;
  createdAt: Date;
}

const trainingSchema = new Schema<ITraining>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    type:        { type: String, required: true },
    date:        { type: String, required: true },
    session:     { type: Number, enum: [1, 2, 3], required: true },
    statChanges: { type: Schema.Types.Mixed, default: {} },
    xpGained:    { type: Number, required: true },
    bonusApplied:{ type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

trainingSchema.index({ userId: 1, date: 1 });

export const Training = model<ITraining>('Training', trainingSchema);
