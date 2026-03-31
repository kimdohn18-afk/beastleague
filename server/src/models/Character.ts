import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacter extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  animalType: string;
  xp: number;
  createdAt: Date;
  updatedAt: Date;
}

const characterSchema = new Schema<ICharacter>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:       { type: String, required: true },
    animalType: { type: String, required: true },
    xp:         { type: Number, default: 0 },
  },
  { timestamps: true }
);

characterSchema.index({ userId: 1 }, { unique: true });

export const Character = model<ICharacter>('Character', characterSchema);
