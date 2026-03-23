import { Schema, model, Document, Types } from 'mongoose';

const statsSchema = new Schema(
  { power: Number, agility: Number, skill: Number, stamina: Number, mind: Number },
  { _id: false }
);

export interface IStatLog extends Document {
  userId: Types.ObjectId;
  characterId: Types.ObjectId;
  source: 'game' | 'training' | 'battle' | 'levelup';
  sourceId: string;
  before: Record<string, number>;
  after: Record<string, number>;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  createdAt: Date;
}

const statLogSchema = new Schema<IStatLog>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
    source:      { type: String, enum: ['game', 'training', 'battle', 'levelup'], required: true },
    sourceId:    { type: String, required: true },
    before:      { type: statsSchema, required: true },
    after:       { type: statsSchema, required: true },
    xpBefore:    { type: Number, required: true },
    xpAfter:     { type: Number, required: true },
    levelBefore: { type: Number, required: true },
    levelAfter:  { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

statLogSchema.index({ userId: 1, createdAt: -1 });

export const StatLog = model<IStatLog>('StatLog', statLogSchema);
