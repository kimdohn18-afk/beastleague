import { Schema, model, Document, Types } from 'mongoose';

const statsSchema = new Schema(
  {
    power:   { type: Number, default: 10, min: 1, max: 100 },
    agility: { type: Number, default: 10, min: 1, max: 100 },
    skill:   { type: Number, default: 10, min: 1, max: 100 },
    stamina: { type: Number, default: 10, min: 1, max: 100 },
    mind:    { type: Number, default: 10, min: 1, max: 100 },
  },
  { _id: false }
);

export interface ICharacter extends Document {
  userId: Types.ObjectId;
  name: string;
  animalType: string;
  level: number;
  xp: number;
  loyalty: number;
  stats: {
    power: number; agility: number; skill: number; stamina: number; mind: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const characterSchema = new Schema<ICharacter>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:      { type: String, required: true },
    animalType:{ type: String, required: true },
    level:     { type: Number, default: 1 },
    xp:        { type: Number, default: 0 },
    loyalty:   { type: Number, default: 50 },
    stats:     { type: statsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

characterSchema.index({ userId: 1 }, { unique: true });

export const Character = model<ICharacter>('Character', characterSchema);
